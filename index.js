const envPath = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
require("dotenv").config({ path: envPath });
console.log(
  `🌍 Mode : ${process.env.NODE_ENV || "production"} (Chargement de ${envPath})`,
);
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} = require("discord.js");
const Database = require("better-sqlite3");
const axios = require("axios");
const { evaluateTriggeredBadges } = require("./badges");

const db = new Database("data/database.db");
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const RIOT_API_KEY = process.env.RIOT_API_KEY
  ? process.env.RIOT_API_KEY.trim()
  : "";

const QUEUE_TYPES = {
  400: "Draft Normale",
  420: "Ranked Solo",
  430: "Blind Pick",
  440: "Ranked Flex",
  450: "ARAM",
  480: "Swiftplay",
  490: "Quickplay",
  700: "Clash",
  720: "ARAM Clash",
  1700: "Arena",
  1710: "Arena (16p)",
  1900: "URF",
  2400: "ARAM Chaos",
};

// --- INITIALISATION ---

client.once("clientReady", async () => {
  console.log(`✅ Bot opérationnel : ${client.user.tag}`);
  ensureSchema();

  db.prepare(
    "DELETE FROM players WHERE puuid NOT IN (SELECT DISTINCT puuid FROM subscriptions)",
  ).run();
  console.log(
    "🧹 Base de données nettoyée (joueurs sans abonnements supprimés).",
  );

  await client.application.commands.create({
    name: "add",
    description: "Ajouter un joueur (Admin)",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      { name: "nom", type: 3, description: "Pseudo", required: true },
      { name: "tag", type: 3, description: "Tag", required: true },
      {
        name: "discord",
        type: 6,
        description: "Compte Discord à lier (optionnel)",
        required: false,
      },
    ],
  });

  await client.application.commands.create({
    name: "remove",
    description: "Retirer un joueur (Admin)",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      {
        name: "nom",
        type: 3,
        description: "Pseudo#Tag (utiliser l'autocomplétion)",
        required: true,
        autocomplete: true,
      },
    ],
  });

  await client.application.commands.create({
    name: "list",
    description: "Voir les joueurs surveillés",
  });

  await client.application.commands.create({
    name: "refresh",
    description: "Forcer une vérification immédiate des matchs",
  });

  await client.application.commands.create({
    name: "synchronisation",
    description: "Synchroniser les PUUID avec la clé API actuelle (Admin)",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  });

  await client.application.commands.create({
    name: "clear",
    description: "Supprimer tous les joueurs suivis dans ce salon (Admin)",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  });

  await client.application.commands.create({
    name: "link",
    description: "Lier un joueur LoL à un compte Discord (Admin)",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      {
        name: "joueur",
        type: 3,
        description: "Joueur à lier (utiliser l'autocomplétion)",
        required: true,
        autocomplete: true,
      },
      {
        name: "discord",
        type: 6,
        description: "Utilisateur Discord",
        required: true,
      },
    ],
  });

  await client.application.commands.create({
    name: "badge-remove",
    description: "Retirer un badge à un joueur (Admin)",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      {
        name: "joueur",
        type: 3,
        description: "Le joueur (utiliser l'autocomplétion)",
        required: true,
        autocomplete: true,
      },
      {
        name: "badge",
        type: 3,
        description: "Clé du badge (ex: TEST_LOSS)",
        required: true,
        autocomplete: true,
      },
    ],
  });

  await client.application.commands.create({
    name: "badge-add",
    description: "Donner un badge manuellement à un joueur (Admin)",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      {
        name: "joueur",
        type: 3,
        description: "Le joueur (utiliser l'autocomplétion)",
        required: true,
        autocomplete: true,
      },
      {
        name: "badge",
        type: 3,
        description: "Clé du badge (ex: TEST_LOSS)",
        required: true,
        autocomplete: true,
      },
    ],
  });

  await client.application.commands.create({
    name: "badges",
    description: "Voir tous les badges obtenus par les joueurs",
  });

  await client.application.commands.create({
    name: "badges-list",
    description:
      "Voir la liste de tous les badges disponibles et leurs descriptions",
  });

  setInterval(checkMatches, 120000);
});

// --- COMMANDES ---

client.on("interactionCreate", async (interaction) => {
  if (interaction.isAutocomplete()) {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === "nom" || focusedOption.name === "joueur") {
      const players = db
        .prepare(
          "SELECT game_name, tag_line, puuid FROM players WHERE game_name LIKE ? OR (game_name || '#' || tag_line) LIKE ?",
        )
        .all(`${focusedOption.value}%`, `%${focusedOption.value}%`)
        .slice(0, 25);

      await interaction.respond(
        players.map((p) => ({
          name: `${p.game_name}#${p.tag_line}`,
          value: p.puuid,
        })),
      );
    }

    if (focusedOption.name === "badge") {
      const { BADGES } = require("./badges");
      const filtered = BADGES.filter(
        (b) =>
          b.key.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
          b.name.toLowerCase().includes(focusedOption.value.toLowerCase()),
      ).slice(0, 25);

      await interaction.respond(
        filtered.map((b) => ({ name: `${b.name} (${b.key})`, value: b.key })),
      );
    }
    return;
  }

  if (!interaction.isCommand()) return;

  if (interaction.commandName === "add") {
    await interaction.deferReply();
    const nom = interaction.options.getString("nom");
    const tag = interaction.options.getString("tag");
    const discordUser = interaction.options.getUser("discord");

    try {
      const accRes = await axios.get(
        `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${nom}/${tag}`,
        { headers: { "X-Riot-Token": RIOT_API_KEY } },
      );
      const { puuid, gameName, tagLine } = accRes.data;
      console.log(
        `📥 [/add] Compte trouvé : ${gameName}#${tagLine} (${puuid})`,
      );

      db.prepare(
        "INSERT OR IGNORE INTO players (puuid, game_name, tag_line, discord_user_id) VALUES (?, ?, ?, ?)",
      ).run(puuid, gameName, tagLine, discordUser ? discordUser.id : null);
      if (discordUser) {
        db.prepare(
          "UPDATE players SET discord_user_id = ? WHERE puuid = ?",
        ).run(discordUser.id, puuid);
      }
      db.prepare(
        "INSERT OR IGNORE INTO subscriptions (puuid, channel_id) VALUES (?, ?)",
      ).run(puuid, interaction.channelId);

      await interaction.editReply(
        discordUser
          ? `✅ **${gameName}#${tagLine}** est sous surveillance ici, lié à ${discordUser}.`
          : `✅ **${gameName}#${tagLine}** est maintenant sous surveillance ici.`,
      );
    } catch (e) {
      await interaction.editReply("❌ Introuvable.");
    }
  }

  if (interaction.commandName === "remove") {
    const identifiant = interaction.options.getString("nom");

    // On cherche le joueur par PUUID (valeur de l'autocomplete) ou par nom
    const player = db
      .prepare(
        "SELECT puuid, game_name, tag_line FROM players WHERE puuid = ? OR game_name = ?",
      )
      .get(identifiant, identifiant);

    if (!player) {
      return interaction.reply({
        content: `❌ Le joueur **${identifiant}** n'est pas dans la base de données.`,
        ephemeral: true,
      });
    }

    const result = db
      .prepare("DELETE FROM subscriptions WHERE channel_id = ? AND puuid = ?")
      .run(interaction.channelId, player.puuid);

    if (result.changes === 0) {
      return interaction.reply({
        content: `❌ Le joueur **${player.game_name}#${player.tag_line}** n'est pas suivi dans ce canal.`,
        ephemeral: true,
      });
    }

    db.prepare(
      "DELETE FROM players WHERE puuid NOT IN (SELECT DISTINCT puuid FROM subscriptions)",
    ).run();

    await interaction.reply(
      `🗑️ **${player.game_name}#${player.tag_line}** a été retiré de la surveillance.`,
    );
  }

  if (interaction.commandName === "list") {
    const rows = db
      .prepare(
        "SELECT p.game_name, p.tag_line, p.discord_user_id FROM players p JOIN subscriptions s ON p.puuid = s.puuid WHERE s.channel_id = ?",
      )
      .all(interaction.channelId);
    await interaction.reply(
      rows.length
        ? `**Joueurs suivis :**\n${rows
            .map(
              (r) =>
                `• ${r.game_name}#${r.tag_line}${r.discord_user_id ? ` -> <@${r.discord_user_id}>` : ""}`,
            )
            .join("\n")}`
        : "Aucun joueur.",
    );
  }

  if (interaction.commandName === "refresh") {
    await interaction.deferReply();
    await checkMatches();
    await interaction.editReply("✅ Vérification terminée.");
  }

  if (interaction.commandName === "synchronisation") {
    await interaction.deferReply();
    await syncPUUIDs();
    await interaction.editReply("✅ Synchronisation des PUUID terminée.");
  }

  if (interaction.commandName === "clear") {
    const result = db
      .prepare("DELETE FROM subscriptions WHERE channel_id = ?")
      .run(interaction.channelId);

    db.prepare(
      "DELETE FROM players WHERE puuid NOT IN (SELECT DISTINCT puuid FROM subscriptions)",
    ).run();

    await interaction.reply(
      result.changes > 0
        ? `🗑️ **${result.changes}** joueur(s) retiré(s) de la surveillance dans ce salon.`
        : "❌ Aucun joueur n'est suivi dans ce salon.",
    );
  }

  if (interaction.commandName === "link") {
    const identifiant = interaction.options.getString("joueur");
    const discordUser = interaction.options.getUser("discord");

    const player = db
      .prepare(
        "SELECT puuid, game_name, tag_line FROM players WHERE puuid = ? OR game_name = ?",
      )
      .get(identifiant, identifiant);

    if (!player) {
      return interaction.reply({
        content: `❌ Joueur introuvable dans le suivi: **${identifiant}**`,
        ephemeral: true,
      });
    }

    db.prepare("UPDATE players SET discord_user_id = ? WHERE puuid = ?").run(
      discordUser.id,
      player.puuid,
    );

    await interaction.reply(
      `🔗 **${player.game_name}#${player.tag_line}** est maintenant lié à ${discordUser}.`,
    );
  }

  if (interaction.commandName === "badge-remove") {
    const puuid = interaction.options.getString("joueur");
    const badgeKey = interaction.options.getString("badge");

    const player = db
      .prepare("SELECT game_name, tag_line FROM players WHERE puuid = ?")
      .get(puuid);

    if (!player) {
      return interaction.reply({
        content: "❌ Joueur introuvable. Utilisez l'autocomplétion.",
        ephemeral: true,
      });
    }

    const result = db
      .prepare("DELETE FROM player_badges WHERE puuid = ? AND badge_key = ?")
      .run(puuid, badgeKey);

    if (result.changes === 0) {
      return interaction.reply({
        content: `❌ Le joueur **${player.game_name}** ne possède pas le badge **${badgeKey}**.`,
        ephemeral: true,
      });
    }

    await interaction.reply(
      `✅ Badge **${badgeKey}** retiré pour **${player.game_name}#${player.tag_line}**.`,
    );
  }

  if (interaction.commandName === "badge-add") {
    const puuidArg = interaction.options.getString("joueur");
    const badgeKey = interaction.options.getString("badge");

    const player = db
      .prepare("SELECT puuid, game_name, tag_line FROM players WHERE puuid = ?")
      .get(puuidArg);

    if (!player) {
      return interaction.reply({
        content: "❌ Joueur introuvable. Utilisez l'autocomplétion.",
        ephemeral: true,
      });
    }

    const { BADGES } = require("./badges");
    const badge = BADGES.find((b) => b.key === badgeKey);

    if (!badge) {
      return interaction.reply({
        content: `❌ Le badge **${badgeKey}** n'existe pas dans la configuration.`,
        ephemeral: true,
      });
    }

    const unlock = registerBadgeUnlock(player.puuid, badge);

    await interaction.reply(
      `✅ Badge **${badge.name}** ajouté manuellement à **${player.game_name}#${player.tag_line}**. (Total: ${unlock.unlockCount})`,
    );
  }

  if (interaction.commandName === "badges") {
    const rows = db
      .prepare(
        `
      SELECT p.game_name, p.tag_line, pb.badge_key, pb.unlock_count 
      FROM players p 
      JOIN player_badges pb ON p.puuid = pb.puuid 
      ORDER BY p.game_name ASC
    `,
      )
      .all();

    if (!rows.length) {
      return interaction.reply(
        "🤷 Aucun badge n'a été débloqué pour le moment.",
      );
    }

    const { BADGES } = require("./badges");
    const grouped = {};
    rows.forEach((row) => {
      const name = `${row.game_name}#${row.tag_line}`;
      if (!grouped[name]) grouped[name] = [];
      const badgeCfg = BADGES.find((b) => b.key === row.badge_key);
      const label = badgeCfg ? badgeCfg.name : row.badge_key;
      grouped[name].push(
        `${label}${row.unlock_count > 1 ? ` (x${row.unlock_count})` : ""}`,
      );
    });

    let message =
      "🏆 **RÉCAPITULATIF DES BADGES** 🏆\n━━━━━━━━━━━━━━━━━━━━━━━━\n";
    for (const [player, badges] of Object.entries(grouped)) {
      message += `👤 **${player}**\n🎖️ ${badges.join(", ")}\n\n`;
    }
    message += "━━━━━━━━━━━━━━━━━━━━━━━━";

    await interaction.reply(message);
  }

  if (interaction.commandName === "badges-list") {
    const { BADGES } = require("./badges");
    let message =
      "📜 **LISTE DES BADGES DISPONIBLES** 📜\n━━━━━━━━━━━━━━━━━━━━━━━━\n";
    BADGES.forEach((badge) => {
      message += `✨ **${badge.name}** (${badge.key})\n├ ${badge.description}\n└ *Répétable : ${badge.repeatable ? "Oui" : "Non"}*\n\n`;
    });
    message += "━━━━━━━━━━━━━━━━━━━━━━━━";
    await interaction.reply(message);
  }
});

// --- HELPERS ---

async function syncPUUIDs() {
  const players = db.prepare("SELECT * FROM players").all();
  for (const player of players) {
    try {
      const res = await axios.get(
        `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${player.game_name}/${player.tag_line}`,
        { headers: { "X-Riot-Token": RIOT_API_KEY } },
      );
      const newPuuid = res.data.puuid;

      if (newPuuid && newPuuid !== player.puuid) {
        db.prepare("UPDATE subscriptions SET puuid = ? WHERE puuid = ?").run(
          newPuuid,
          player.puuid,
        );
        db.prepare("UPDATE players SET puuid = ? WHERE puuid = ?").run(
          newPuuid,
          player.puuid,
        );
        console.log(`✅ PUUID synchronisé : ${player.game_name}`);
      }
    } catch (e) {
      console.error(
        `❌ Échec synchronisation ${player.game_name}: ${e.message}`,
      );
    }
  }
}

function formatBadgeAnnouncement(player, unlockedBadges) {
  if (!unlockedBadges.length) return "";

  const discordLabel = player.discord_user_id
    ? `<@${player.discord_user_id}>`
    : `**${player.game_name}**`;
  const badgesText = unlockedBadges
    .map((badge) => `le badge **${badge.name}** : ${badge.description}`)
    .join(", et ");
  return `🎖️ Grâce à sa performance, ${discordLabel} gagne ${badgesText}.`;
}

/**
 * Récupère le rank et les LP d'un joueur via l'API Riot (by-puuid).
 * @param {string} puuid - Le PUUID du joueur
 * @param {number} queueId - L'ID de la queue (420 = Solo, 440 = Flex)
 * @returns {Promise<{tier: string, rank: string, lp: number} | null>}
 */
async function fetchPlayerRank(puuid, queueId) {
  // On n'affiche le rank que pour Solo (420) et Flex (440)
  if (queueId !== 420 && queueId !== 440) return null;

  try {
    const axiosConfig = { headers: { "X-Riot-Token": RIOT_API_KEY } };

    // Nouvel endpoint by-puuid sur la plateforme euw1 (fixe)
    const url = `https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
    const leagueRes = await axios.get(url, axiosConfig);

    // Cherche la queue correspondante (Solo ou Flex)
    const queueType = queueId === 440 ? "RANKED_FLEX_SR" : "RANKED_SOLO_5x5";
    const entry = leagueRes.data.find((e) => e.queueType === queueType);

    if (!entry) return null;

    return {
      tier: entry.tier,
      rank: entry.rank,
      lp: entry.leaguePoints,
    };
  } catch (e) {
    if (e.response?.status === 403) {
      console.error(
        `❌ Erreur 403 Riot API : Vérifiez si votre clé est bien à jour sur le portail.`,
      );
    } else {
      console.error(
        `⚠️ Impossible de récupérer le rank (${puuid}) : ${e.message}`,
      );
    }
    return null;
  }
}

/**
 * Met à jour la série de défaites consécutives d'un joueur.
 * @param {string} puuid - Le PUUID du joueur
 * @param {boolean} isWin - true si le joueur a gagné
 * @returns {number} La valeur actuelle de la streak
 */
function updateLossStreak(puuid, isWin) {
  if (isWin) {
    db.prepare("UPDATE players SET loss_streak = 0 WHERE puuid = ?").run(puuid);
    return 0;
  }

  db.prepare(
    "UPDATE players SET loss_streak = loss_streak + 1 WHERE puuid = ?",
  ).run(puuid);

  const row = db
    .prepare("SELECT loss_streak FROM players WHERE puuid = ?")
    .get(puuid);
  return row ? row.loss_streak : 1;
}

function ensureSchema() {
  try {
    db.exec("ALTER TABLE players ADD COLUMN discord_user_id TEXT");
    console.log("✅ Colonne discord_user_id ajoutée.");
  } catch (e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS player_badges (
      puuid TEXT NOT NULL,
      badge_key TEXT NOT NULL,
      first_unlocked_at TEXT NOT NULL,
      last_unlocked_at TEXT NOT NULL,
      unlock_count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (puuid, badge_key)
    );
  `);
}

function registerBadgeUnlock(puuid, badge) {
  const nowIso = new Date().toISOString();
  const exists = db
    .prepare(
      "SELECT unlock_count FROM player_badges WHERE puuid = ? AND badge_key = ?",
    )
    .get(puuid, badge.key);

  if (exists && !badge.repeatable) {
    return { isNew: false, unlockCount: exists.unlock_count };
  }

  if (!exists) {
    db.prepare(
      "INSERT INTO player_badges (puuid, badge_key, first_unlocked_at, last_unlocked_at, unlock_count) VALUES (?, ?, ?, ?, 1)",
    ).run(puuid, badge.key, nowIso, nowIso);
    return { isNew: true, unlockCount: 1 };
  }

  db.prepare(
    "UPDATE player_badges SET unlock_count = unlock_count + 1, last_unlocked_at = ? WHERE puuid = ? AND badge_key = ?",
  ).run(nowIso, puuid, badge.key);
  return { isNew: true, unlockCount: exists.unlock_count + 1 };
}

function formatBadgeAnnouncement(player, unlockedBadges) {
  if (!unlockedBadges.length) return "";

  const discordLabel = player.discord_user_id
    ? `<@${player.discord_user_id}>`
    : `**${player.game_name}** (compte Discord non lié)`;
  const badgesText = unlockedBadges
    .map((badge) => `le badge **${badge.name}** : ${badge.description}`)
    .join(", et ");
  return `🎖️ Grâce à sa performance, ${discordLabel} gagne ${badgesText}.`;
}

async function checkMatches() {
  const players = db.prepare("SELECT * FROM players").all();
  console.log(
    `🚀 Lancement de la vérification pour ${players.length} joueurs...`,
  );

  for (const player of players) {
    try {
      console.log(`⏳ Vérification : ${player.game_name}`);
      const axiosConfig = { headers: { "X-Riot-Token": RIOT_API_KEY } };
      const lolMatchUrl = `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${player.puuid}/ids?count=1`;

      const lolRes = await axios.get(lolMatchUrl, axiosConfig);
      const lastId = lolRes.data ? lolRes.data[0] : null;

      if (lastId && lastId !== player.last_match_id) {
        db.prepare("UPDATE players SET last_match_id = ? WHERE puuid = ?").run(
          lastId,
          player.puuid,
        );

        const detailUrl = `https://europe.api.riotgames.com/lol/match/v5/matches/${lastId}`;
        const detRes = await axios.get(detailUrl, axiosConfig);
        const info = detRes.data.info;
        const p = info.participants.find((part) => part.puuid === player.puuid);

        if (!p || info.gameDuration <= 300) continue;

        // Mise à jour de la streak (pour toutes les games)
        const streak = updateLossStreak(player.puuid, p.win);

        // On n'envoie un message que pour les défaites
        if (!p.win) {
          const queueName = QUEUE_TYPES[info.queueId] || "Partie";
          const min = Math.floor(info.gameDuration / 60);
          const sec = (info.gameDuration % 60).toString().padStart(2, "0");

          // Récupération du rank/LP
          const rankData = await fetchPlayerRank(player.puuid, info.queueId);

          // Construction du message
          let message = `🚨 [${queueName}] - **${player.game_name}** a perdu avec **${p.championName}** (${p.kills}/${p.deaths}/${p.assists}) en **${min}:${sec}** min.`;

          if (rankData) {
            message += ` - ${rankData.tier} ${rankData.rank} — ${rankData.lp} LP`;
          }

          if (streak > 1) {
            message += `\n🔥 Série de défaites : ${streak}`;
          }

          const subs = db
            .prepare("SELECT channel_id FROM subscriptions WHERE puuid = ?")
            .all(player.puuid);

          const triggeredBadges = evaluateTriggeredBadges(p, streak);
          const unlockedBadges = [];
          for (const badge of triggeredBadges) {
            const unlock = registerBadgeUnlock(player.puuid, badge);
            if (unlock.isNew) {
              unlockedBadges.push(badge);
            }
          }
          if (unlockedBadges.length > 0) {
            message += `\n${formatBadgeAnnouncement(player, unlockedBadges)}`;
          }

          for (const sub of subs) {
            const chan = await client.channels
              .fetch(sub.channel_id)
              .catch(() => null);
            if (chan) await chan.send(message);
          }
        }
      } else {
        console.log(`✅ [${player.game_name}] Aucun nouveau match.`);
      }
    } catch (e) {
      console.error(`❌ Erreur ${player.game_name}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

client.login(process.env.DISCORD_TOKEN);
