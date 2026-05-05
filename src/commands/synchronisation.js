const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("synchronisation")
    .setDescription("Synchroniser les membres du serveur avec la base de données (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const members = await interaction.guild.members.fetch();
    let count = 0;
    
    for (const [id, member] of members) {
      const result = db.prepare("UPDATE accounts SET discord_user_id = ? WHERE discord_user_id = ?").run(id, id);
      if (result.changes > 0) count++;
    }

    const embed = new EmbedBuilder()
      .setTitle("🔄 Synchronisation terminée")
      .setColor(0x3498db)
      .setDescription(`La synchronisation des membres a été effectuée.`)
      .addFields({ name: "Utilisateurs mis à jour", value: `\`${count}\`` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
