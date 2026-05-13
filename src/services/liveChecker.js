const { db } = require("../database");
const { getActiveGameByPuuid, getChampionName } = require("./riot");

/** Au-delà de cette fenêtre, une partie n’est plus considérée comme « live ». */
const LIVE_TTL_MS = 5 * 60 * 1000;

/** Délai minimum entre deux polls Spectator pour un même PUUID (anti rate-limit). */
const SPECTATOR_MIN_INTERVAL_MS = 90 * 1000;

const lastCheckByPuuid = new Map();

function upsertLiveGame(game, observedAtMs) {
  db.prepare(
    `
    INSERT INTO live_games (id, queue_id, game_mode, map_id, started_at_ms, observed_at_ms)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      queue_id      = excluded.queue_id,
      game_mode     = excluded.game_mode,
      map_id        = excluded.map_id,
      started_at_ms = excluded.started_at_ms,
      observed_at_ms = excluded.observed_at_ms
    `,
  ).run(
    String(game.gameId),
    game.gameQueueConfigId || null,
    game.gameMode || null,
    game.mapId || null,
    game.gameStartTime || 0,
    observedAtMs,
  );
}

async function upsertParticipants(game, serverPuuids) {
  /**
   * Réécrit en bloc les 10 participants : si un participant n’est plus dans la
   * partie (improbable), il sort de la table. Le `is_server` est calculé à partir
   * du set des PUUIDs suivis pour le serveur en cours.
   */
  const id = String(game.gameId);
  const stmtUpsert = db.prepare(
    `
    INSERT INTO live_participants (game_id, puuid, summoner_name, champion_id, champion_name, team_id, is_server)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(game_id, puuid) DO UPDATE SET
      summoner_name = excluded.summoner_name,
      champion_id   = excluded.champion_id,
      champion_name = excluded.champion_name,
      team_id       = excluded.team_id,
      is_server     = excluded.is_server
    `,
  );

  for (const p of game.participants || []) {
    if (!p?.puuid) continue;
    const championName = p.championId ? await getChampionName(p.championId) : null;
    const sumName =
      (p.summonerName && String(p.summonerName).trim()) ||
      (p.riotId && String(p.riotId).trim()) ||
      "Invocateur";
    stmtUpsert.run(
      id,
      p.puuid,
      sumName,
      p.championId ?? null,
      championName || null,
      p.teamId,
      serverPuuids.has(p.puuid) ? 1 : 0,
    );
  }
}

function pruneStaleGames(observedAtMs) {
  const cutoff = observedAtMs - LIVE_TTL_MS;
  db.prepare(`DELETE FROM live_participants WHERE game_id IN (SELECT id FROM live_games WHERE observed_at_ms < ?)`).run(cutoff);
  db.prepare(`DELETE FROM live_games WHERE observed_at_ms < ?`).run(cutoff);
}

/**
 * Itère sur tous les comptes suivis, interroge Riot Spectator V5 et met à
 * jour les tables `live_games` / `live_participants`. À brancher dans le cron
 * du bot toutes les 90–120 s pour respecter les limites Riot.
 */
async function checkLiveGames() {
  const accounts = db
    .prepare(`SELECT puuid FROM accounts`)
    .all();
  if (accounts.length === 0) return;

  const serverPuuids = new Set(accounts.map((a) => a.puuid));
  const now = Date.now();
  /** PUUIDs déjà couverts par une partie connue : on ne re-poll pas tout le monde. */
  const coveredPuuids = new Set();

  for (const acc of accounts) {
    if (coveredPuuids.has(acc.puuid)) continue;
    const last = lastCheckByPuuid.get(acc.puuid) || 0;
    if (now - last < SPECTATOR_MIN_INTERVAL_MS) continue;
    lastCheckByPuuid.set(acc.puuid, now);

    const game = await getActiveGameByPuuid(acc.puuid);
    if (!game) continue;

    try {
      upsertLiveGame(game, now);
      await upsertParticipants(game, serverPuuids);
    } catch (e) {
      console.error(`live_games upsert (${acc.puuid}): ${e.message}`);
    }

    /**
     * Tous les autres comptes du serveur présents dans cette partie n’ont pas
     * besoin d’un appel Spectator séparé : on les marque comme couverts.
     */
    for (const p of game.participants || []) {
      if (serverPuuids.has(p.puuid)) coveredPuuids.add(p.puuid);
    }

    // Petit délai pour ne pas frapper l’API en rafale.
    await new Promise((r) => setTimeout(r, 80));
  }

  pruneStaleGames(now);
}

module.exports = {
  checkLiveGames,
  LIVE_TTL_MS,
};
