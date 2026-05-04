const { SlashCommandBuilder } = require("discord.js");
const { BADGES } = require("../../badges");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("badges-list")
    .setDescription("Voir la liste des badges disponibles"),
  async execute(interaction) {
    let message =
      "📜 **LISTE DES BADGES DISPONIBLES** 📜\n━━━━━━━━━━━━━━━━━━━━━━━━\n";
    const ranks = ["Bronze", "Argent", "Or"];
    const rankEmojis = {
      "Bronze": "🥉",
      "Argent": "🥈",
      "Or": "🥇"
    };

    ranks.forEach(rank => {
      const rankBadges = BADGES.filter(b => b.rank === rank);
      if (rankBadges.length) {
        const emoji = rankEmojis[rank] || "🌟";
        message += `\n${emoji} **Rang ${rank}** ${emoji}\n`;
        rankBadges.forEach((badge) => {
          message += `**${badge.name}**\n├ ${badge.description}\n└ *Répétable : ${badge.repeatable ? "Oui" : "Non"}*\n\n`;
        });
      }
    });
    message += "━━━━━━━━━━━━━━━━━━━━━━━━";
    await interaction.reply(message);
  },
};
