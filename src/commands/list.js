const { SlashCommandBuilder } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder().setName("list").setDescription("Voir les joueurs surveillés"),
  async execute(interaction) {
    const rows = db.prepare("SELECT p.game_name, p.tag_line, p.discord_user_id FROM players p JOIN subscriptions s ON p.puuid = s.puuid WHERE s.channel_id = ?").all(interaction.channelId);
    await interaction.reply(rows.length ? `**Joueurs suivis :**\n${rows.map((r) => `• ${r.game_name}#${r.tag_line}${r.discord_user_id ? ` -> <@${r.discord_user_id}>` : ""}`).join("\n")}` : "Aucun joueur.");
  }
};
