const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("../database");
const { BADGES } = require("../../badges");

module.exports = {
  data: new SlashCommandBuilder().setName("badges").setDescription("Voir tous les badges obtenus par joueur"),
  async execute(interaction) {
    // On récupère tous les badges avec les infos des comptes liés
    const rows = db.prepare(`
      SELECT 
        b.badge_key, 
        b.unlock_count, 
        a.discord_user_id, 
        a.game_name, 
        a.tag_line,
        a.puuid
      FROM badges b
      LEFT JOIN accounts a ON b.entity_id = a.puuid
    `).all();

    if (!rows.length) return interaction.reply({ content: "🤷 Aucun badge n'a été débloqué pour le moment.", ephemeral: true });

    const grouped = {}; // { identifier: { badge_key: total_count } }

    for (const row of rows) {
      let identifier = row.discord_user_id ? `user:${row.discord_user_id}` : `lol:${row.puuid}`;
      
      if (!grouped[identifier]) grouped[identifier] = {};
      if (!grouped[identifier][row.badge_key]) grouped[identifier][row.badge_key] = 0;
      grouped[identifier][row.badge_key] += row.unlock_count;
    }

    const embed = new EmbedBuilder()
      .setTitle("🏆 RÉCAPITULATIF DES BADGES")
      .setColor(0xf1c40f)
      .setTimestamp();

    for (const [id, badges] of Object.entries(grouped)) {
      let nameLabel = id;
      if (id.startsWith("user:")) {
        const discordId = id.split(":")[1];
        try {
          const user = interaction.client.users.cache.get(discordId) || await interaction.client.users.fetch(discordId);
          nameLabel = `👤 ${user.globalName || user.username}`;
        } catch {
          nameLabel = `👤 Utilisateur Discord (${discordId})`;
        }
      } else {
        const puuid = id.split(":")[1];
        const p = db.prepare("SELECT game_name, tag_line FROM accounts WHERE puuid = ?").get(puuid);
        nameLabel = p ? `🎮 ${p.game_name}#${p.tag_line}` : `🎮 Compte Inconnu (${puuid})`;
      }

      const badgesList = Object.entries(badges).map(([key, count]) => {
        const badgeCfg = BADGES.find((b) => b.key === key);
        const label = badgeCfg ? `**${badgeCfg.name}**` : `\`${key}\``;
        return `${label}${count > 1 ? ` (x${count})` : ""}`;
      });

      embed.addFields({ name: nameLabel, value: badgesList.join(", "), inline: false });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
