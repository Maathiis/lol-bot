const fs = require("fs");
const path = require("path");
const envPath = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
require("dotenv").config({ path: envPath });

const { Client, Collection, GatewayIntentBits } = require("discord.js");
const { ensureSchema, db } = require("./src/database");
const { checkMatches } = require("./src/services/matchChecker");
const { announceMonthlyStats } = require("./src/services/cron");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
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

client.once("ready", async () => {
  ensureSchema();

  db.prepare(
    "DELETE FROM players WHERE puuid NOT IN (SELECT DISTINCT puuid FROM subscriptions)",
  ).run();

  // Déploiement des commandes en cache local
  const commandsData = client.commands.map((c) => c.data.toJSON());
  await client.application.commands.set(commandsData);

  setInterval(() => checkMatches(client), 60000);

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
          "SELECT DISTINCT p.game_name, p.tag_line, p.puuid FROM players p JOIN subscriptions s ON p.puuid = s.puuid WHERE (p.game_name LIKE ? OR (p.game_name || '#' || p.tag_line) LIKE ?) AND s.guild_id = ?",
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
        const subcommand = interaction.options.getSubcommand(false);
        let entityId;
        if (subcommand === "discord") {
          entityId = interaction.options.get("utilisateur")?.value;
        } else if (subcommand === "lol") {
          let lolUser = interaction.options.getString("joueur");
          if (lolUser) {
            const player = db.prepare("SELECT puuid FROM players WHERE puuid = ? OR game_name = ?").get(lolUser, lolUser);
            if (player) entityId = player.puuid;
          }
        }

        if (entityId) {
          const ownedBadgeKeys = db.prepare("SELECT badge_key FROM entity_badges WHERE entity_id = ?").all(entityId).map(r => r.badge_key);
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

client.login(process.env.DISCORD_TOKEN);
