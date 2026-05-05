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
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      let label = `**${r.identifier}**`;
      if (r.is_discord) {
        try {
          const user = interaction.client.users.cache.get(r.identifier) || await interaction.client.users.fetch(r.identifier);
          label = `**${user.globalName || user.username}**`;
        } catch { }
      }
      msg += `${i + 1}. ${label} : **${r.total_month}** défaites\n`;
    }
    msg += "━━━━━━━━━━━━━━━━━━━━━━━━";
    await interaction.reply(msg);
  }
};
