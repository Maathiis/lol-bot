const { SlashCommandBuilder } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder().setName("list").setDescription("Voir les joueurs surveillés"),
  async execute(interaction) {
    const rows = db.prepare("SELECT p.game_name, p.tag_line, p.discord_user_id FROM players p JOIN subscriptions s ON p.puuid = s.puuid WHERE s.channel_id = ?").all(interaction.channelId);

    if (rows.length === 0) {
      return interaction.reply("Aucun joueur.");
    }

    const userGroups = {};
    const unlinked = [];

    for (const row of rows) {
      const accountStr = `${row.game_name}#${row.tag_line}`;
      if (row.discord_user_id) {
        if (!userGroups[row.discord_user_id]) userGroups[row.discord_user_id] = [];
        userGroups[row.discord_user_id].push(accountStr);
      } else {
        unlinked.push(accountStr);
      }
    }

    const lines = [];

    for (const [discordId, accounts] of Object.entries(userGroups)) {
      try {
        const user = interaction.client.users.cache.get(discordId) || await interaction.client.users.fetch(discordId);
        const name = user.globalName || user.username || discordId;
        lines.push(`• **${name}** : ${accounts.join(' / ')}`);
      } catch {
        lines.push(`• **${discordId}** : ${accounts.join(' / ')}`);
      }
    }

    if (unlinked.length > 0) {
      lines.push(`• **Non lié** : ${unlinked.join(' / ')}`);
    }

    await interaction.reply(`**Joueurs suivis :**\n${lines.join("\n")}`);
  }
};
