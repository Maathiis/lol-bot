const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { db } = require("../database");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Supprimer tous les joueurs suivis dans ce salon (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    // Création d'un fichier de sauvegarde de sécurité avant le clear
    const backupName = `data/database_backup_clear_${Date.now()}.db`;
    fs.copyFileSync("data/database.db", backupName);

    const result = db.prepare(`
      DELETE FROM server_members
      WHERE server_id IN (SELECT id FROM servers WHERE guild_id = ?)
    `).run(interaction.guildId);
    db.prepare("DELETE FROM accounts WHERE puuid NOT IN (SELECT DISTINCT puuid FROM server_members)").run();
    
    if (result.changes > 0) {
      const embed = new EmbedBuilder()
        .setTitle("🗑️ Surveillance réinitialisée")
        .setColor(0xffa500)
        .setDescription(`**${result.changes}** joueur(s) ont été retirés de la surveillance sur ce serveur.`)
        .addFields({ name: "Sauvegarde", value: `Une sauvegarde a été créée : \`${backupName}\`` })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply({ content: "❌ Aucun joueur n'est suivi sur ce serveur.", ephemeral: true });
    }
  }
};
