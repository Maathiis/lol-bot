const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats-month")
    .setDescription("Afficher le total des défaites du mois pour tous les joueurs"),
  async execute(interaction) {
    const monthStr = new Date().toISOString().slice(0, 7);

    // Récupération des données détaillées pour chaque joueur surveillé sur ce serveur
    const rows = db.prepare(`
      SELECT 
        COALESCE(p.discord_user_id, p.puuid) as identifier,
        MAX(p.discord_user_id) as discord_user_id,
        p.game_name,
        p.tag_line,
        MAX(p.max_loss_streak) as max_streak,
        SUM(ms.losses) as total_losses,
        SUM(ms.games) as total_games,
        SUM(ms.total_time_spent_dead) as total_time_dead
      FROM monthly_stats ms 
      JOIN accounts p ON p.puuid = ms.puuid
      JOIN server_members sm ON sm.puuid = p.puuid
      JOIN servers s ON s.id = sm.server_id
      WHERE ms.month = ? AND s.guild_id = ?
      GROUP BY identifier
      ORDER BY total_losses DESC
    `).all(monthStr, interaction.guildId);

    if (!rows.length) {
      return interaction.reply({ content: "🤷 Aucune défaite enregistrée ce mois-ci sur ce serveur.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`📅 Bilan des défaites - ${monthStr}`)
      .setColor(0xe67e22)
      .setTimestamp();

    let description = "";

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      
      const lossRate = r.total_games > 0 ? Math.round((r.total_losses / r.total_games) * 100) : 0;
      
      let badgeCount = 0;
      if (r.discord_user_id) {
        const bStats = db.prepare(`
          SELECT SUM(unlock_count) as count 
          FROM badges 
          WHERE entity_id IN (SELECT puuid FROM accounts WHERE discord_user_id = ?)
        `).get(r.discord_user_id);
        badgeCount = bStats?.count || 0;
      } else {
        const bStats = db.prepare("SELECT SUM(unlock_count) as count FROM badges WHERE entity_id = ?").get(r.identifier);
        badgeCount = bStats?.count || 0;
      }

      let label = `**${r.game_name}#${r.tag_line}**`;
      if (r.discord_user_id) {
        try {
          const user = await interaction.client.users.fetch(r.discord_user_id);
          label = `**${user.globalName || user.username}**`;
        } catch { }
      }

      const h = Math.floor(r.total_time_dead / 3600);
      const m = Math.floor((r.total_time_dead % 3600) / 60);
      const deadStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

      description += `${i + 1}. ${label} : \`${r.total_losses}\` défaites\n` +
                     `╰ *${lossRate}% winrate | Streak: ${r.max_streak} | 🎖️ ${badgeCount} | 💀 ${deadStr}*\n\n`;
    }

    embed.setDescription(description || "Aucune donnée.");
    embed.setFooter({ text: "Classement basé sur l'humiliation mensuelle." });

    await interaction.reply({ embeds: [embed] });
  }
};
