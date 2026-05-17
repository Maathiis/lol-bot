const fs = require("fs");
const path = require("path");
const envPath = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
require("dotenv").config({ path: envPath });

const { Client, Collection, GatewayIntentBits, Partials } = require("discord.js");
const { ensureSchema, db } = require("./src/database");
const { checkMatches } = require("./src/services/matchChecker");
const { checkLiveGames } = require("./src/services/liveChecker");
const { announceMonthlyStats } = require("./src/services/cron");
const { startMatchDetailServer } = require("./src/services/matchDetailServer");
const { setupWallListener } = require("./src/services/wallListener");
const { startMockTimer } = require("./src/services/mockTimer");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "src", "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(
      `[WARNING] La commande au chemin ${filePath} n'a pas les propriétés requises "data" ou "execute".`,
    );
  }
}

// Serveur HTTP local pour servir les détails de parties au front Next.js
startMatchDetailServer();

client.once("clientReady", async () => {
  ensureSchema();

  // Nettoyage des comptes orphelins (ceux qui ne sont plus suivis sur aucun serveur)
  db.prepare(
    "DELETE FROM accounts WHERE puuid NOT IN (SELECT DISTINCT puuid FROM server_members)",
  ).run();

  // Déploiement des commandes en cache local
  const commandsData = client.commands.map((c) => c.data.toJSON());
  await client.application.commands.set(commandsData);

  console.log("✅ Bot prêt et base de données synchronisée !");

  setInterval(() => checkMatches(client), 60000);

  // Poll Spectator V5 toutes les 60 s pour alimenter `live_games` / `live_participants`
  // (snapshots sorts / KDA / or si l’API les expose).
  checkLiveGames().catch((e) => console.error("live tick:", e?.message || e));
  setInterval(() => {
    checkLiveGames().catch((e) => console.error("live tick:", e?.message || e));
  }, 60_000);

  // Vérification horaire pour l'annonce mensuelle
  setInterval(
    async () => {
      const now = new Date();
      if (
        now.getDate() === 1 &&
        now.getHours() === 12 &&
        now.getMinutes() < 60
      ) {
        const currentMonthStr = now.toISOString().slice(0, 7);
        if (global.lastAnnouncedMonth !== currentMonthStr) {
          global.lastAnnouncedMonth = currentMonthStr;
          await announceMonthlyStats(client);
        }
      }
    },
    60 * 60 * 1000,
  );
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isAutocomplete()) {
    const focusedOption = interaction.options.getFocused(true);

    if (
      focusedOption.name === "nom" ||
      focusedOption.name === "joueur" ||
      focusedOption.name === "lol"
    ) {
      const players = db
        .prepare(
          "SELECT DISTINCT p.game_name, p.tag_line, p.puuid FROM accounts p JOIN server_members sm ON sm.puuid = p.puuid JOIN servers s ON s.id = sm.server_id WHERE (p.game_name LIKE ? OR (p.game_name || '#' || p.tag_line) LIKE ?) AND s.guild_id = ?",
        )
        .all(`${focusedOption.value}%`, `%${focusedOption.value}%`, interaction.guildId)
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
      let availableBadges = BADGES;

      if (interaction.commandName === "badge-remove") {
        let entityId;
        let lolUser = interaction.options.getString("joueur");
        if (lolUser) {
          const player = db.prepare("SELECT puuid FROM accounts WHERE puuid = ? OR game_name = ?").get(lolUser, lolUser);
          if (player) entityId = player.puuid;
        }

        if (entityId) {
          const ownedBadgeKeys = db.prepare("SELECT badge_key FROM badges WHERE entity_id = ?").all(entityId).map(r => r.badge_key);
          availableBadges = BADGES.filter(b => ownedBadgeKeys.includes(b.key));
        } else {
          availableBadges = []; // Force picking a user first
        }
      }

      const filtered = availableBadges.filter(
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

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content:
          "Une erreur est survenue lors de l'exécution de cette commande.",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content:
          "Une erreur est survenue lors de l'exécution de cette commande.",
        ephemeral: true,
      });
    }
  }
});

setupWallListener(client);
startMockTimer(client);

client.login(process.env.DISCORD_TOKEN);
