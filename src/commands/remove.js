const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Retirer un joueur (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt.setName("nom").setDescription("Pseudo#Tag").setRequired(true).setAutocomplete(true)),
  async execute(interaction) {
    const identifiant = interaction.options.getString("nom");
    const player = db.prepare("SELECT puuid, game_name, tag_line FROM players WHERE puuid = ? OR game_name = ?").get(identifiant, identifiant);

    if (!player) return interaction.reply({ content: `❌ Le joueur **${identifiant}** n'est pas dans la base de données.`, ephemeral: true });

    const result = db.prepare("DELETE FROM subscriptions WHERE channel_id = ? AND puuid = ?").run(interaction.channelId, player.puuid);
    if (result.changes === 0) return interaction.reply({ content: `❌ Le joueur **${player.game_name}#${player.tag_line}** n'est pas suivi dans ce canal.`, ephemeral: true });

    db.prepare("DELETE FROM players WHERE puuid NOT IN (SELECT DISTINCT puuid FROM subscriptions)").run();
    await interaction.reply(`🗑️ **${player.game_name}#${player.tag_line}** a été retiré de la surveillance.`);
  }
};
