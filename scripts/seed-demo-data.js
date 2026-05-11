/**
 * Remplit la BDD de dev avec historique, stats mensuelles et badges
 * (clés réelles de `badge_definitions`) pour les comptes déjà présents.
 *
 * Idempotent : supprime d’abord les matchs `demo_*`, puis réécrit.
 * Peut être appelé depuis `prep-test-data.js` ou seul :
 *   npm run seed:demo
 */
const path = require("path");

const CHAMPIONS = [
  "Ahri",
  "Jinx",
  "Yasuo",
  "Lee Sin",
  "Thresh",
  "Lux",
  "Ezreal",
  "Katarina",
  "Darius",
  "Morgana",
  "Viego",
  "Seraphine",
];

const QUEUES = [420, 440, 450, 400];

function seedDemoData(db) {
  const accounts = db
    .prepare(`SELECT puuid, game_name FROM accounts ORDER BY puuid`)
    .all();
  if (!accounts.length) {
    console.log("⚠️  seed-demo : aucun compte dans `accounts`, rien à faire.");
    return;
  }

  let badgeKeys = [];
  try {
    badgeKeys = db
      .prepare(
        `SELECT id FROM badge_definitions WHERE UPPER(TRIM(rank)) != 'SECRET' ORDER BY id`,
      )
      .pluck()
      .all();
  } catch {
    badgeKeys = [];
  }
  if (!badgeKeys.length) {
    console.log(
      "⚠️  seed-demo : pas de `badge_definitions` (non secrets) — stats + matchs seulement.",
    );
  }

  db.prepare(`DELETE FROM match_history WHERE id GLOB 'demo_*'`).run();

  const insMatch = db.prepare(`
    INSERT OR REPLACE INTO match_history (
      id, puuid, champion_name, kills, deaths, assists,
      duration_seconds, queue_id, played_at, win, badges_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const upsertMonthly = db.prepare(`
    INSERT OR REPLACE INTO monthly_stats (puuid, month, losses, games, total_time_spent_dead)
    VALUES (?, ?, ?, ?, ?)
  `);

  const upsertBadge = db.prepare(`
    INSERT INTO badges (entity_id, is_discord, badge_key, first_unlocked_at, last_unlocked_at, unlock_count)
    VALUES (?, 0, ?, ?, ?, ?)
    ON CONFLICT(entity_id, badge_key) DO UPDATE SET
      unlock_count = excluded.unlock_count,
      last_unlocked_at = excluded.last_unlocked_at
  `);

  const anchor = Date.UTC(2026, 4, 11, 18, 0, 0);
  let matchCount = 0;

  accounts.forEach((acc, i) => {
    const { puuid } = acc;
    const n = 14 + (i % 9);
    let losses = 0;
    let wins = 0;
    let deadSec = 0;

    for (let m = 0; m < n; m += 1) {
      const win = (m + i * 2) % 3 !== 0;
      const id = `demo_${m}`;
      const tOff = (m * 47 + i * 3600 * 11) % (86400000 * 40);
      const playedAt = new Date(anchor - tOff).toISOString();
      const k = (m * 3 + i * 5) % CHAMPIONS.length;
      const champion = CHAMPIONS[k];
      const kills = 2 + (m + i) % 9;
      const deaths = win ? 3 + (m % 6) : 6 + (m % 9);
      const assists = (m * 2 + i) % 15;
      const duration = 720 + ((m + i) * 97) % 2100;
      const queueId = QUEUES[(m + i) % QUEUES.length];
      deadSec += 40 + (m % 120) * (win ? 1 : 3);

      let badgesJson = null;
      if (!win && badgeKeys.length && m % 3 === 0) {
        const a = badgeKeys[(m + i * 4) % badgeKeys.length];
        const b =
          badgeKeys.length > 1
            ? badgeKeys[(m + i * 4 + 3) % badgeKeys.length]
            : null;
        badgesJson = JSON.stringify(b && a !== b ? [a, b] : [a]);
      }

      insMatch.run(
        id,
        puuid,
        champion,
        kills,
        deaths,
        assists,
        duration,
        queueId,
        playedAt,
        win ? 1 : 0,
        badgesJson,
      );
      matchCount += 1;
      if (win) wins += 1;
      else losses += 1;
    }

    const maxStreak = 2 + (i % 6);
    const lossStreak = i % 4;
    db.prepare(
      `
      UPDATE accounts SET
        total_losses = ?,
        max_loss_streak = ?,
        loss_streak = ?,
        total_time_spent_dead = ?,
        last_match_at = ?
      WHERE puuid = ?
    `,
    ).run(losses, maxStreak, lossStreak, deadSec, anchor, puuid);

    const d0 = new Date(anchor);
    const y = d0.getUTCFullYear();
    const mo = String(d0.getUTCMonth() + 1).padStart(2, "0");
    const monthKey = `${y}-${mo}`;
    const prev = new Date(Date.UTC(y, d0.getUTCMonth() - 1, 15));
    const prevKey = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;

    upsertMonthly.run(
      puuid,
      monthKey,
      Math.max(1, Math.floor(losses * 0.45)),
      Math.max(2, Math.floor((losses + wins) * 0.5)),
      Math.floor(deadSec * 0.4),
    );
    upsertMonthly.run(
      puuid,
      prevKey,
      3 + (i % 8),
      8 + (i % 12),
      800 + (i % 200) * 10,
    );

    if (badgeKeys.length) {
      const nb = Math.min(8, 3 + (i % 5));
      for (let b = 0; b < nb; b += 1) {
        const key = badgeKeys[(i * 7 + b * 13) % badgeKeys.length];
        const first = new Date(anchor - (b + 1) * 86400000 * 3).toISOString();
        const last = new Date(anchor - b * 86400000).toISOString();
        const cnt = 1 + (b % 4);
        upsertBadge.run(puuid, key, first, last, cnt);
      }
    }
  });

  console.log(
    `✅ seed-demo : ${accounts.length} compte(s), ${matchCount} ligne(s) match_history (demo_*), stats + badges.`,
  );
}

function main() {
  const root = path.join(__dirname, "..");
  process.chdir(root);
  if (!process.env.DATABASE_PATH) {
    process.env.DATABASE_PATH = path.join(root, "data", "database_2.db");
  }
  require("dotenv").config({ path: path.join(root, ".env") });
  const dbPath = path.join(root, "src", "database.js");
  delete require.cache[dbPath];
  const { ensureSchema, db } = require(dbPath);
  ensureSchema();
  seedDemoData(db);
}

module.exports = { seedDemoData };

if (require.main === module) {
  main();
}
