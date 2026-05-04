const { SlashCommandBuilder } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Afficher les statistiques globales")
    .addUserOption(opt => opt.setName("discord").setDescription("Utilisateur Discord").setRequired(false))
    .addStringOption(opt => opt.setName("lol").setDescription("Compte LoL").setRequired(false).setAutocomplete(true)),
  async execute(interaction) {
    const discordUser = interaction.options.getUser("discord");
    const lolUser = interaction.options.getString("lol");

    if (!discordUser && !lolUser) return interaction.reply({ content: "❌ Veuillez spécifier un utilisateur Discord ou un compte LoL.", ephemeral: true });

    const monthStr = new Date().toISOString().slice(0, 7);
    let title = "", totalLosses = 0, maxStreak = 0, currentStreak = 0, monthlyLosses = 0, monthlyGames = 0, badgesCount = 0;

    if (discordUser) {
      title = `📊 Statistiques globales de ${discordUser.displayName || discordUser.username}`;
      const stats = db.prepare("SELECT SUM(total_losses) as t_losses, MAX(max_loss_streak) as m_streak, SUM(loss_streak) as c_streak FROM players WHERE discord_user_id = ?").get(discordUser.id);
      const mStats = db.prepare("SELECT SUM(losses) as m_losses, SUM(games) as m_games FROM monthly_losses ml JOIN players p ON p.puuid = ml.puuid WHERE p.discord_user_id = ? AND ml.month = ?").get(discordUser.id, monthStr);
      const bStats = db.prepare("SELECT SUM(unlock_count) as b_count FROM entity_badges WHERE entity_id = ? AND is_discord = 1").get(discordUser.id);

      totalLosses = stats?.t_losses || 0; maxStreak = stats?.m_streak || 0; currentStreak = stats?.c_streak || 0;
      monthlyLosses = mStats?.m_losses || 0; monthlyGames = mStats?.m_games || 0; badgesCount = bStats?.b_count || 0;
    } else {
      const player = db.prepare("SELECT puuid, game_name, tag_line, total_losses, max_loss_streak, loss_streak FROM players WHERE puuid = ? OR game_name = ?").get(lolUser, lolUser);
      if (!player) return interaction.reply({ content: "❌ Joueur introuvable.", ephemeral: true });
      title = `📊 Statistiques de **${player.game_name}#${player.tag_line}**`;
      
      const mStats = db.prepare("SELECT losses, games FROM monthly_losses WHERE puuid = ? AND month = ?").get(player.puuid, monthStr);
      const bStats = db.prepare("SELECT SUM(unlock_count) as b_count FROM entity_badges WHERE entity_id = ? AND is_discord = 0").get(player.puuid);

      totalLosses = player.total_losses || 0; maxStreak = player.max_loss_streak || 0; currentStreak = player.loss_streak || 0;
      monthlyLosses = mStats?.losses || 0; monthlyGames = mStats?.games || 0; badgesCount = bStats?.b_count || 0;
    }

    const lossRate = monthlyGames > 0 ? Math.round((monthlyLosses / monthlyGames) * 100) : 0;

    const embed = {
      title: title,
      color: 0xff0000,
      fields: [
        { name: "📉 Défaites totales", value: `${totalLosses}`, inline: true },
        { name: "📅 Défaites ce mois", value: `${monthlyLosses}`, inline: true },
        { name: "📊 % Défaites (mois)", value: monthlyGames > 0 ? `${lossRate}% (${monthlyLosses}/${monthlyGames})` : "0%", inline: true },
        { name: "🔥 Série en cours", value: `${currentStreak}`, inline: true },
        { name: "👑 Pire série historique", value: `${maxStreak}`, inline: true },
        { name: "🎖️ Badges obtenus", value: `${badgesCount}`, inline: true },
      ]
    };
    await interaction.reply({ embeds: [embed] });
  }
};
