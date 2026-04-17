require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} = require("discord.js");
const Database = require("better-sqlite3");
const axios = require("axios");

const db = new Database("database.db");
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
    ],
  });

  await client.application.commands.create({
    name: "remove",
    description: "Retirer un joueur (Admin)",
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [{ name: "nom", type: 3, description: "Pseudo", required: true }],
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

  setInterval(checkMatches, 120000);
});

// --- COMMANDES ---

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "add") {
    await interaction.deferReply();
    const nom = interaction.options.getString("nom");
    const tag = interaction.options.getString("tag");

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
        "INSERT OR IGNORE INTO players (puuid, game_name, tag_line) VALUES (?, ?, ?)",
      ).run(puuid, gameName, tagLine);
      db.prepare(
        "INSERT OR IGNORE INTO subscriptions (puuid, channel_id) VALUES (?, ?)",
      ).run(puuid, interaction.channelId);

      await interaction.editReply(
        `✅ **${gameName}#${tagLine}** est maintenant sous surveillance ici.`,
      );
    } catch (e) {
      await interaction.editReply("❌ Introuvable.");
    }
  }

  if (interaction.commandName === "remove") {
    const nom = interaction.options.getString("nom");
    const result = db
      .prepare(
        `DELETE FROM subscriptions WHERE channel_id = ? AND puuid IN (SELECT puuid FROM players WHERE game_name LIKE ?)`,
      )
      .run(interaction.channelId, nom);

    if (result.changes === 0) {
      return interaction.reply({
        content: `❌ Le joueur **${nom}** n'est pas suivi dans ce canal.`,
        ephemeral: true,
      });
    }

    db.prepare(
      "DELETE FROM players WHERE puuid NOT IN (SELECT DISTINCT puuid FROM subscriptions)",
    ).run();

    await interaction.reply(`🗑️ **${nom}** a été retiré de la surveillance.`);
  }

  if (interaction.commandName === "list") {
    const rows = db
      .prepare(
        "SELECT p.game_name, p.tag_line FROM players p JOIN subscriptions s ON p.puuid = s.puuid WHERE s.channel_id = ?",
      )
      .all(interaction.channelId);
    await interaction.reply(
      rows.length
        ? `**Joueurs suivis :**\n${rows.map((r) => `• ${r.game_name}#${r.tag_line}`).join("\n")}`
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

        if (p && !p.win && info.gameDuration > 300) {
          const queueName = QUEUE_TYPES[info.queueId] || "Partie";
          const min = Math.floor(info.gameDuration / 60);
          const sec = (info.gameDuration % 60).toString().padStart(2, "0");
          const message = `🚨 [${queueName}] - **${player.game_name}** a perdu avec **${p.championName}** (${p.kills}/${p.deaths}/${p.assists}) en **${min}:${sec}** min.`;

          const subs = db
            .prepare("SELECT channel_id FROM subscriptions WHERE puuid = ?")
            .all(player.puuid);
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
