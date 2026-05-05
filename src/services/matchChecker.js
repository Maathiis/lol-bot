const axios = require("axios");
const { db } = require("../database");
const { RIOT_API_KEY, QUEUE_TYPES, fetchPlayerRank } = require("./riot");
const { evaluateTriggeredBadges } = require("../../badges");

function updateLossStats(player, isWin) {
  const puuid = player.puuid;
  const monthStr = new Date().toISOString().slice(0, 7);

  if (isWin) {
    db.prepare("UPDATE players SET loss_streak = 0 WHERE puuid = ?").run(puuid);
    db.prepare(
      `
      INSERT INTO monthly_losses (puuid, month, losses, games) 
      VALUES (?, ?, 0, 1) 
      ON CONFLICT(puuid, month) DO UPDATE SET games = games + 1
    `,
    ).run(puuid, monthStr);
  } else {
    db.prepare(
      `
      UPDATE players 
      SET loss_streak = loss_streak + 1, 
          total_losses = total_losses + 1 
      WHERE puuid = ?
    `,
    ).run(puuid);

    db.prepare(
      `
      UPDATE players
      SET max_loss_streak = MAX(max_loss_streak, loss_streak)
      WHERE puuid = ?
    `,
    ).run(puuid);

    db.prepare(
      `
      INSERT INTO monthly_losses (puuid, month, losses, games) 
      VALUES (?, ?, 1, 1) 
      ON CONFLICT(puuid, month) DO UPDATE SET losses = losses + 1, games = games + 1
    `,
    ).run(puuid, monthStr);
  }

  if (player.discord_user_id) {
    const row = db
      .prepare(
        "SELECT SUM(loss_streak) as sum_streak FROM players WHERE discord_user_id = ?",
      )
      .get(player.discord_user_id);
    return row ? row.sum_streak : 0;
  } else {
    const row = db
      .prepare("SELECT loss_streak FROM players WHERE puuid = ?")
      .get(puuid);
    return row ? row.loss_streak : 0;
  }
}

function registerBadgeUnlock(entityId, isDiscord, badge) {
  const nowIso = new Date().toISOString();
  const exists = db
    .prepare(
      "SELECT unlock_count FROM entity_badges WHERE entity_id = ? AND badge_key = ?",
    )
    .get(entityId, badge.key);

  if (exists && !badge.repeatable) {
    return { isNew: false, unlockCount: exists.unlock_count };
  }

  if (!exists) {
    db.prepare(
      "INSERT INTO entity_badges (entity_id, is_discord, badge_key, first_unlocked_at, last_unlocked_at, unlock_count) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(entityId, isDiscord ? 1 : 0, badge.key, nowIso, nowIso);
    return { isNew: true, unlockCount: 1 };
  }

  db.prepare(
    "UPDATE entity_badges SET unlock_count = unlock_count + 1, last_unlocked_at = ? WHERE entity_id = ? AND badge_key = ?",
  ).run(nowIso, entityId, badge.key);
  return { isNew: true, unlockCount: exists.unlock_count + 1 };
}

async function formatBadgeAnnouncement(client, player, unlockedBadges) {
  if (!unlockedBadges.length) return "";

  let discordLabel = `**${player.game_name}**`;
  if (player.discord_user_id) {
    try {
      const user =
        client.users.cache.get(player.discord_user_id) ||
        (await client.users.fetch(player.discord_user_id));
      discordLabel = `**${user.globalName || user.username}**`;
    } catch {
      // fallback
    }
  }

  let announcement = "";

  const normalBadges = unlockedBadges.filter((b) => b.rank !== "Secret");
  const secretBadges = unlockedBadges.filter((b) => b.rank === "Secret");

  if (normalBadges.length > 0) {
    const badgesText = normalBadges
      .map(
        (badge) =>
          `le badge **${badge.name}** (${badge.rank}) : ${badge.description}`,
      )
      .join(", et ");
    announcement += `🎖️ Grâce à sa performance, ${discordLabel} gagne ${badgesText}.\n`;
  }

  if (secretBadges.length > 0) {
    const secretText = secretBadges
      .map((badge) => `**${badge.name}** : *${badge.description}*`)
      .join(", et ");
    announcement += `🚨 **BWAHAHAHAH!!** ${discordLabel} vient de gagner le badge **SECRET** 🤫 : ${secretText} !!\n`;
  }

  return announcement.trim();
}

async function checkMatches(client) {
  const players = db.prepare("SELECT * FROM players").all();
  const now = Date.now();

  for (const player of players) {
    try {
      // --- LOGIQUE D'INTERVALLE ADAPTATIF ---
      const lastMatchAt = player.last_match_at || 0;
      const lastCheckedAt = player.last_checked_at || 0;
      const timeSinceLastMatch = now - lastMatchAt;
      const timeSinceLastCheck = now - lastCheckedAt;

      let interval = 2 * 60 * 1000; // Par défaut 2 min
      if (lastMatchAt > 0) {
        if (timeSinceLastMatch > 24 * 60 * 60 * 1000) {
          interval = 30 * 60 * 1000; // > 24h : 30 min
        } else if (timeSinceLastMatch > 2 * 60 * 60 * 1000) {
          interval = 15 * 60 * 1000; // > 2h : 15 min
        }
      }

      if (timeSinceLastCheck < interval) continue;

      // Mise à jour du timestamp de vérification
      db.prepare("UPDATE players SET last_checked_at = ? WHERE puuid = ?").run(
        now,
        player.puuid,
      );

      console.log(`⏳ Vérification : ${player.game_name}`);
      const axiosConfig = { headers: { "X-Riot-Token": RIOT_API_KEY } };

      // On récupère les 5 derniers matchs pour être sûr de ne rien rater
      const lolMatchUrl = `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${player.puuid}/ids?count=2`;
      const lolRes = await axios.get(lolMatchUrl, axiosConfig);
      const matchIds = lolRes.data || [];

      // Identifier les nouveaux matchs
      let newMatchIds = [];
      if (player.last_match_id) {
        const lastIndex = matchIds.indexOf(player.last_match_id);
        if (lastIndex === -1) {
          // Soit c'est le premier match, soit il a joué plus de 5 parties depuis le dernier check
          newMatchIds = matchIds;
        } else {
          // On ne prend que ce qui est plus récent que last_match_id
          newMatchIds = matchIds.slice(0, lastIndex);
        }
      } else if (matchIds.length > 0) {
        // Premier lancement pour ce joueur
        db.prepare(
          "UPDATE players SET last_match_id = ?, last_match_at = ? WHERE puuid = ?",
        ).run(
          matchIds[0],
          now, // On initialise avec maintenant pour éviter de remonter tout l'historique
          player.puuid,
        );
        continue;
      }

      // On traite du plus VIEUX au plus RÉCENT
      newMatchIds.reverse();

      for (const matchId of newMatchIds) {
        const detailUrl = `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`;
        const detRes = await axios.get(detailUrl, axiosConfig);
        const info = detRes.data.info;
        const p = info.participants.find((part) => part.puuid === player.puuid);

        // Mise à jour immédiate du dernier match traité
        db.prepare(
          "UPDATE players SET last_match_id = ?, last_match_at = ? WHERE puuid = ?",
        ).run(matchId, info.gameEndTimestamp, player.puuid);

        if (!p || info.gameDuration <= 300) continue;

        const activeStreak = updateLossStats(player, p.win);

        if (!p.win) {
          const queueName = QUEUE_TYPES[info.queueId] || "Partie";
          const min = Math.floor(info.gameDuration / 60);
          const sec = (info.gameDuration % 60).toString().padStart(2, "0");

          const rankData = await fetchPlayerRank(player.puuid, info.queueId);

          let message = `🚨 [${queueName}] - **${player.game_name}** a perdu avec **${p.championName}** (${p.kills}/${p.deaths}/${p.assists}) en **${min}:${sec}** min.`;

          if (rankData) {
            message += ` - ${rankData.tier} ${rankData.rank} — ${rankData.lp} LP`;
          }

          if (activeStreak > 1) {
            message += `\n🔥 Série de défaites : ${activeStreak}`;
          }

          const subs = db
            .prepare("SELECT channel_id FROM subscriptions WHERE puuid = ?")
            .all(player.puuid);

          const triggeredBadges = evaluateTriggeredBadges(
            p,
            activeStreak,
            info,
          );
          const unlockedBadges = [];
          const entityId = player.discord_user_id || player.puuid;
          const isDiscord = player.discord_user_id ? 1 : 0;

          for (const badge of triggeredBadges) {
            const unlock = registerBadgeUnlock(entityId, isDiscord, badge);
            if (unlock.isNew) {
              unlockedBadges.push(badge);
            }
          }
          if (unlockedBadges.length > 0) {
            message += `\n${await formatBadgeAnnouncement(client, player, unlockedBadges)}`;
          }

          for (const sub of subs) {
            const chan = await client.channels
              .fetch(sub.channel_id)
              .catch(() => null);
            if (chan) await chan.send(message);
          }
        }
      }
    } catch (e) {
      console.error(`❌ Erreur ${player.game_name}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

module.exports = {
  checkMatches,
  registerBadgeUnlock,
};
