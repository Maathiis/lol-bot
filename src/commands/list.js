const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder().setName("list").setDescription("Voir les joueurs surveillés"),
  async execute(interaction) {
    await interaction.deferReply();
    const rows = db.prepare("SELECT p.game_name, p.tag_line, p.discord_user_id FROM accounts p JOIN guild_tracking s ON p.puuid = s.puuid WHERE s.guild_id = ? GROUP BY p.puuid").all(interaction.guildId);

    if (rows.length === 0) {
      return interaction.editReply("❌ Aucun joueur n'est surveillé sur ce serveur.");
    }

    const embed = new EmbedBuilder()
      .setTitle("📋 Joueurs sous surveillance")
      .setColor(0x5865f2)
      .setTimestamp();

    const userGroups = {};
    const unlinked = [];

    for (const row of rows) {
      const accountStr = `\`${row.game_name}#${row.tag_line}\``;
      if (row.discord_user_id) {
        if (!userGroups[row.discord_user_id]) userGroups[row.discord_user_id] = [];
        userGroups[row.discord_user_id].push(accountStr);
      } else {
        unlinked.push(accountStr);
      }
    }

    for (const [discordId, accounts] of Object.entries(userGroups)) {
      try {
        const user = interaction.client.users.cache.get(discordId) || await interaction.client.users.fetch(discordId);
        embed.addFields({ name: `👤 ${user.globalName || user.username}`, value: accounts.join(" / "), inline: true });
      } catch {
        embed.addFields({ name: `👤 ID: ${discordId}`, value: accounts.join(" / "), inline: true });
      }
    }

    if (unlinked.length > 0) {
      embed.addFields({ name: "🔗 Non liés", value: unlinked.join(" / "), inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};
