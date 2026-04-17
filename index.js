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

const RIOT_API_KEY = process.env.RIOT_API_KEY ? process.env.RIOT_API_KEY.trim() : "";

const QUEUE_TYPES = {
  400: "Draft Normale",
  420: "Ranked Solo",
  430: "Blind Pick",
  440: "Ranked Flex",
  450: "ARAM",
  700: "Clash",
  1700: "Arena",
  1090: "TFT Normale",
  1100: "TFT Ranked",
};

// --- INITIALISATION ---

client.once("clientReady", async () => {
  console.log(`✅ Bot opérationnel : ${client.user.tag}`);

  // Nettoyage automatique des joueurs orphelins au démarrage
  db.prepare(
    "DELETE FROM players WHERE puuid NOT IN (SELECT DISTINCT puuid FROM subscriptions)",
  ).run();
  console.log("🧹 Base de données nettoyée (joueurs sans abonnements supprimés).");

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

  setInterval(checkMatches, 120000); // Check toutes les 2 min
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
        `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${nom}/${tag}?api_key=${RIOT_API_KEY}`,
      );
      const { puuid, gameName, tagLine } = accRes.data;
      console.log(`📥 [/add] Compte trouvé : ${gameName}#${tagLine} (${puuid})`);

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

    // Supprimer l'abonnement
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

    // Nettoyage des joueurs qui n'ont plus d'abonnements du tout
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
    console.log("📥 Commande /refresh reçue !");
    await interaction.deferReply();
    const count = db.prepare("SELECT count(*) as count FROM players").get().count;
    if (count === 0) {
      return interaction.editReply("❌ Aucun joueur n'est enregistré.");
    }
    await checkMatches();
    await interaction.editReply("✅ Vérification immédiate des matchs terminée.");
  }

  if (interaction.commandName === "synchronisation") {
    await interaction.deferReply();
    const count = db.prepare("SELECT count(*) as count FROM players").get().count;
    if (count === 0) {
      return interaction.editReply("❌ Aucun joueur n'est enregistré.");
    }
    await syncPUUIDs();
    await interaction.editReply("✅ Synchronisation des PUUID terminée.");
  }
});

// --- SYNCHRONISATION PUUID (Robuste) ---

async function syncPUUIDs() {
  const players = db.prepare("SELECT * FROM players").all();
  for (const player of players) {
    try {
      const res = await axios.get(
        `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${player.game_name}/${player.tag_line}?api_key=${RIOT_API_KEY}`,
      );
      const newPuuid = res.data.puuid;

      if (newPuuid && newPuuid !== player.puuid) {
        // Prévention des conflits UNIQUE : si le nouveau PUUID existe déjà
        const existing = db
          .prepare("SELECT puuid FROM players WHERE puuid = ?")
          .get(newPuuid);

        if (existing) {
          // Fusion des abonnements et suppression de l'ancien record
          db.prepare("UPDATE subscriptions SET puuid = ? WHERE puuid = ?").run(
            newPuuid,
            player.puuid,
          );
          db.prepare("DELETE FROM players WHERE puuid = ?").run(player.puuid);
        } else {
          // Mise à jour classique
          db.prepare("UPDATE subscriptions SET puuid = ? WHERE puuid = ?").run(
            newPuuid,
            player.puuid,
          );
          db.prepare("UPDATE players SET puuid = ? WHERE puuid = ?").run(
            newPuuid,
            player.puuid,
          );
        }
        console.log(`✅ PUUID synchronisé : ${player.game_name}`);
      }
    } catch (e) {
      console.error(
        `❌ Échec synchronisation ${player.game_name}: ${e.message}`,
      );
    }
  }
}

// --- BOUCLE ---

async function checkMatches() {
  const players = db.prepare("SELECT * FROM players").all();
  console.log(`🚀 Lancement de la vérification pour ${players.length} joueurs...`);

  for (const player of players) {
    try {
      console.log(`⏳ Vérification en cours pour ${player.game_name}...`);
      // On check LoL ET TFT
      const lolMatchUrl = `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${player.puuid}/ids?count=1&api_key=${RIOT_API_KEY}`;
      const tftMatchUrl = `https://europe.api.riotgames.com/tft/match/v1/matches/by-puuid/${player.puuid}/ids?count=1&api_key=${RIOT_API_KEY}`;

      const [lolRes, tftRes] = await Promise.all([
        axios.get(lolMatchUrl),
        axios.get(tftMatchUrl),
      ]);
      const lastId = lolRes.data[0] || tftRes.data[0];

      if (lastId && lastId !== player.last_match_id) {
        // Enregistrement immédiat pour éviter les doublons si checkMatches est rappelé
        db.prepare("UPDATE players SET last_match_id = ? WHERE puuid = ?").run(
          lastId,
          player.puuid,
        );

        console.log(
          `🔍 [${player.game_name}] Nouveau match détecté: ${lastId}`,
        );
        const isTft = lastId.includes("TFT");
        const detailUrl = isTft
          ? `https://europe.api.riotgames.com/tft/match/v1/matches/${lastId}?api_key=${RIOT_API_KEY}`
          : `https://europe.api.riotgames.com/lol/match/v5/matches/${lastId}?api_key=${RIOT_API_KEY}`;

        const detRes = await axios.get(detailUrl);
        const info = detRes.data.info;
        const p = info.participants.find((part) => part.puuid === player.puuid);

        if (p) {
          console.log(`📊 [${player.game_name}] Données du match récupérées.`);
          let shouldNotify = false;
          let message = "";
          const queueName = QUEUE_TYPES[info.queueId] || "Partie";

          if (isTft) {
            // TFT : Défaite si Top 5 ou +
            if (p.placement > 4) {
              shouldNotify = true;
              message = `🏟️ [${queueName}] - **${player.game_name}** a fait un **Top ${p.placement}**... Loser.`;
            } else {
              console.log(
                `⏩ [${player.game_name}] TFT Top ${p.placement}: Pas de notification.`,
              );
            }
          } else {
            // LoL : Défaite classique
            if (!p.win && info.gameDuration > 300) {
              shouldNotify = true;
              const min = Math.floor(info.gameDuration / 60);
              const sec = (info.gameDuration % 60).toString().padStart(2, "0");
              message = `🚨 [${queueName}] - **${player.game_name}** a perdu avec **${p.championName}** (${p.kills}/${p.deaths}/${p.assists}) en **${min}:${sec}** min.`;
            } else {
              console.log(
                `⏩ [${player.game_name}] LoL ${p.win ? "Victoire" : "Défaite"} (Durée: ${info.gameDuration}s): Pas de notification.`,
              );
            }
          }

          if (shouldNotify) {
            const subs = db
              .prepare("SELECT channel_id FROM subscriptions WHERE puuid = ?")
              .all(player.puuid);

            if (subs.length === 0) {
              console.log(
                `⚠️ [${player.game_name}] Aucune souscription trouvée pour ce joueur.`,
              );
            }

            for (const sub of subs) {
              const chan = await client.channels
                .fetch(sub.channel_id)
                .catch((err) => {
                  console.error(
                    `❌ [${player.game_name}] Impossible de fetch le salon ${sub.channel_id}: ${err.message}`,
                  );
                  return null;
                });
              if (chan) {
                console.log(
                  `✉️ [${player.game_name}] Envoi du message dans le salon ${chan.name}...`,
                );
                await chan.send(message);
              }
            }
          }
        }
      } else {
        console.log(`✅ [${player.game_name}] Aucun nouveau match.`);
      }
    } catch (e) {
      if (e.response && e.response.status === 403) {
        console.error(
          `Erreur ${player.game_name}: 403 Forbidden. Votre clé API Riot a probablement expiré (renouvelez-la sur https://developer.riotgames.com/).`,
        );
      } else if (e.response && e.response.status === 429) {
        console.error(`Erreur ${player.game_name}: 429 Rate Limit exceeded.`);
      } else if (e.response && e.response.status === 400) {
        console.error(
          `Erreur ${player.game_name}: 400 Bad Request. Tapez /refresh pour synchroniser vos joueurs avec la nouvelle clé API.`,
        );
      } else {
        console.error(`Erreur ${player.game_name}: ${e.message}`);
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

client.login(process.env.DISCORD_TOKEN);
