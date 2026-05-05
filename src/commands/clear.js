const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
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

    const result = db.prepare("DELETE FROM subscriptions WHERE guild_id = ?").run(interaction.guildId);
    db.prepare("DELETE FROM players WHERE puuid NOT IN (SELECT DISTINCT puuid FROM subscriptions)").run();
    await interaction.reply(result.changes > 0 ? `🗑️ **${result.changes}** joueur(s) retiré(s) de la surveillance sur ce serveur.\n*(Une sauvegarde de sécurité a été créée en interne : \`${backupName}\`)*` : "❌ Aucun joueur n'est suivi sur ce serveur.");
  }
};
