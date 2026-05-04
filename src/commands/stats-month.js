const { SlashCommandBuilder } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder().setName("stats-month").setDescription("Afficher le total des défaites du mois pour tous les joueurs"),
  async execute(interaction) {
    const monthStr = new Date().toISOString().slice(0, 7);
    const rows = db.prepare(`
      SELECT COALESCE(p.discord_user_id, p.game_name || '#' || p.tag_line) as identifier, MAX(p.discord_user_id) as is_discord, SUM(ml.losses) as total_month
      FROM monthly_losses ml JOIN players p ON p.puuid = ml.puuid
      WHERE ml.month = ? GROUP BY identifier ORDER BY total_month DESC
    `).all(monthStr);

    if (!rows.length) return interaction.reply("🤷 Aucune défaite enregistrée ce mois-ci.");

    let msg = `📅 **BILAN DES DÉFAITES DU MOIS (${monthStr})** 📅\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    rows.forEach((r, i) => {
      const label = r.is_discord ? `<@${r.identifier}>` : `**${r.identifier}**`;
      msg += `${i + 1}. ${label} : **${r.total_month}** défaites\n`;
    });
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━";
    await interaction.reply(msg);
  }
};
