const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats-server")
    .setDescription("Afficher les statistiques globales du serveur"),
  async execute(interaction) {
    const monthStr = new Date().toISOString().slice(0, 7);

    // 1. Stats globales
    const globalStats = db.prepare(`
      SELECT 
        SUM(p.total_losses) as total_all_time,
        SUM(ms.losses) as total_month,
        SUM(ms.games) as games_month,
        SUM(p.total_time_spent_dead) as total_dead_all_time
      FROM accounts p
      LEFT JOIN monthly_stats ms ON p.puuid = ms.puuid AND ms.month = ?
      JOIN server_members sm ON sm.puuid = p.puuid
      JOIN servers s ON s.id = sm.server_id
      WHERE s.guild_id = ?
    `).get(monthStr, interaction.guildId);

    // 2. Pire série historique
    const kingOfLoss = db.prepare(`
      SELECT p.game_name, p.tag_line, p.max_loss_streak, p.discord_user_id
      FROM accounts p
      JOIN server_members sm ON sm.puuid = p.puuid
      JOIN servers s ON s.id = sm.server_id
      WHERE s.guild_id = ?
      ORDER BY p.max_loss_streak DESC
      LIMIT 1
    `).get(interaction.guildId);

    // 3. Total des badges sur le serveur
    // Comme les badges sont sur les PUUID, on compte tous les badges des PUUID suivis sur ce serveur
    const totalBadges = db.prepare(`
      SELECT SUM(unlock_count) as count
      FROM badges
      WHERE entity_id IN (SELECT DISTINCT sm.puuid FROM server_members sm JOIN servers s ON s.id = sm.server_id WHERE s.guild_id = ?)
    `).get(interaction.guildId);

    const totalAllTime = globalStats?.total_all_time || 0;
    const totalMonth = globalStats?.total_month || 0;
    const gamesMonth = globalStats?.games_month || 0;
    const lossRateMonth = gamesMonth > 0 ? Math.round((totalMonth / gamesMonth) * 100) : 0;

    let kingLabel = "Personne encore...";
    if (kingOfLoss) {
      kingLabel = `${kingOfLoss.game_name}#${kingOfLoss.tag_line} (${kingOfLoss.max_loss_streak})`;
      if (kingOfLoss.discord_user_id) {
        try {
          const user = await interaction.client.users.fetch(kingOfLoss.discord_user_id);
          kingLabel = `${user.globalName || user.username} (${kingOfLoss.max_loss_streak})`;
        } catch {}
      }
    }

    const totalDead = globalStats?.total_dead_all_time || 0;
    const h = Math.floor(totalDead / 3600);
    const m = Math.floor((totalDead % 3600) / 60);
    const deadStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

    const embed = new EmbedBuilder()
      .setTitle("📊 Statistiques du serveur")
      .setColor(0x5865f2)
      .setThumbnail(interaction.guild.iconURL())
      .addFields(
        { name: "📉 Défaites totales", value: `\`${totalAllTime}\``, inline: true },
        { name: "📅 Défaites ce mois", value: `\`${totalMonth}\``, inline: true },
        { name: "📊 % Défaites (mois)", value: `\`${lossRateMonth}%\` (${totalMonth}/${gamesMonth})`, inline: true },
        { name: "👑 Pire série historique", value: kingLabel, inline: true },
        { name: "🎖️ Badges obtenus", value: `\`${totalBadges?.count || 0}\``, inline: true },
        { name: "💀 Temps d'écran gris", value: `\`${deadStr}\``, inline: true }
      )
      .setFooter({ text: "L'union fait la défaite." })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
