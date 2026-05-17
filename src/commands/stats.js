const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Afficher les statistiques globales")
    .addSubcommand((sub) =>
      sub
        .setName("discord")
        .setDescription("Afficher les statistiques d'un utilisateur Discord")
        .addUserOption((opt) => opt.setName("utilisateur").setDescription("Utilisateur Discord").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("lol")
        .setDescription("Afficher les statistiques d'un compte LoL")
        .addStringOption((opt) => opt.setName("joueur").setDescription("Compte LoL").setRequired(true).setAutocomplete(true))
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    const monthStr = new Date().toISOString().slice(0, 7);
    let title = "", totalLosses = 0, maxStreak = 0, currentStreak = 0, monthlyLosses = 0, monthlyGames = 0, badgesCount = 0, totalTimeDead = 0, thumbnail = null;

    if (subcommand === "discord") {
      const discordUser = interaction.options.getUser("utilisateur");
      title = `Statistiques de ${discordUser.displayName || discordUser.username}`;
      thumbnail = discordUser.displayAvatarURL();
      
      const isTracked = db.prepare(`SELECT 1 FROM accounts p JOIN server_members sm ON sm.puuid = p.puuid JOIN servers s ON s.id = sm.server_id WHERE p.discord_user_id = ? AND s.guild_id = ?`).get(discordUser.id, interaction.guildId);
      if (!isTracked) return interaction.reply({ content: "❌ Cet utilisateur n'est lié à aucun compte LoL surveillé sur ce serveur.", ephemeral: true });

      const stats = db.prepare(`
        SELECT 
          SUM(total_losses) as t_losses, 
          MAX(max_loss_streak) as m_streak, 
          SUM(loss_streak) as c_streak, 
          SUM(total_time_spent_dead) as t_time
        FROM accounts 
        WHERE discord_user_id = ?
      `).get(discordUser.id);

      const mStats = db.prepare("SELECT SUM(losses) as m_losses, SUM(games) as m_games FROM monthly_stats ms JOIN accounts p ON p.puuid = ms.puuid WHERE p.discord_user_id = ? AND ms.month = ?").get(discordUser.id, monthStr);
      
      // On somme les badges de TOUS les comptes LoL liés
      const bStats = db.prepare(`
        SELECT SUM(unlock_count) as b_count 
        FROM badges 
        WHERE entity_id IN (SELECT puuid FROM accounts WHERE discord_user_id = ?)
      `).get(discordUser.id);

      totalLosses = stats?.t_losses || 0; maxStreak = stats?.m_streak || 0; currentStreak = stats?.c_streak || 0;
      monthlyLosses = mStats?.m_losses || 0; monthlyGames = mStats?.m_games || 0; badgesCount = bStats?.b_count || 0;
      totalTimeDead = stats?.t_time || 0;
    } else if (subcommand === "lol") {
      const lolUser = interaction.options.getString("joueur");
      const player = db.prepare(`
        SELECT p.*
        FROM accounts p
        JOIN server_members sm ON sm.puuid = p.puuid
        JOIN servers s ON s.id = sm.server_id
        WHERE (p.puuid = ? OR p.game_name = ?) AND s.guild_id = ?
      `).get(lolUser, lolUser, interaction.guildId);
      
      if (!player) return interaction.reply({ content: "❌ Joueur introuvable ou non surveillé sur ce serveur.", ephemeral: true });
      title = `Statistiques de ${player.game_name}#${player.tag_line}`;
      
      const mStats = db.prepare("SELECT losses, games FROM monthly_stats WHERE puuid = ? AND month = ?").get(player.puuid, monthStr);
      const bStats = db.prepare("SELECT SUM(unlock_count) as b_count FROM badges WHERE entity_id = ?").get(player.puuid);

      totalLosses = player.total_losses || 0; maxStreak = player.max_loss_streak || 0; currentStreak = player.loss_streak || 0;
      monthlyLosses = mStats?.losses || 0; monthlyGames = mStats?.games || 0; badgesCount = bStats?.b_count || 0;
      totalTimeDead = player.total_time_spent_dead || 0;
    }

    const lossRate = monthlyGames > 0 ? Math.round((monthlyLosses / monthlyGames) * 100) : 0;

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${title}`)
      .setColor(0xff0000)
      .setTimestamp();
      
    if (thumbnail) embed.setThumbnail(thumbnail);

    const hours = Math.floor(totalTimeDead / 3600);
    const minutes = Math.floor((totalTimeDead % 3600) / 60);
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    embed.addFields(
      { name: "📉 Défaites totales", value: `\`${totalLosses}\``, inline: true },
      { name: "📅 Défaites ce mois", value: `\`${monthlyLosses}\``, inline: true },
      { name: "📊 % Défaites (mois)", value: monthlyGames > 0 ? `\`${lossRate}%\` (${monthlyLosses}/${monthlyGames})` : "`0%`", inline: true },
      { name: "🔥 Série en cours", value: `\`${currentStreak}\``, inline: true },
      { name: "👑 Pire série", value: `\`${maxStreak}\``, inline: true },
      { name: "🎖️ Badges obtenus", value: `\`${badgesCount}\``, inline: true },
      { name: "💀 Temps passé mort", value: `\`${timeStr}\``, inline: true },
    );

    await interaction.reply({ embeds: [embed] });
  }
};
