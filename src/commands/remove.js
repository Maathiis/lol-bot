const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Retirer un joueur (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt.setName("nom").setDescription("Pseudo#Tag").setRequired(true).setAutocomplete(true)),
  async execute(interaction) {
    const identifiant = interaction.options.getString("nom");
    const player = db.prepare("SELECT puuid, game_name, tag_line FROM accounts WHERE puuid = ? OR game_name = ?").get(identifiant, identifiant);

    if (!player) return interaction.reply({ content: `❌ Le joueur **${identifiant}** n'est pas dans la base de données.`, ephemeral: true });

    const result = db.prepare("DELETE FROM guild_tracking WHERE guild_id = ? AND puuid = ?").run(interaction.guildId, player.puuid);
    if (result.changes === 0) return interaction.reply({ content: `❌ Le joueur **${player.game_name}#${player.tag_line}** n'est pas suivi sur ce serveur.`, ephemeral: true });

    db.prepare("DELETE FROM accounts WHERE puuid NOT IN (SELECT DISTINCT puuid FROM guild_tracking)").run();
    
    const embed = new EmbedBuilder()
      .setTitle("🗑️ Joueur retiré")
      .setColor(0xe74c3c)
      .setDescription(`**${player.game_name}#${player.tag_line}** ne sera plus surveillé sur ce serveur.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
