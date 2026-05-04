const { SlashCommandBuilder } = require("discord.js");
const { db } = require("../database");
const { BADGES } = require("../../badges");

module.exports = {
  data: new SlashCommandBuilder().setName("badges").setDescription("Voir tous les badges obtenus"),
  async execute(interaction) {
    const rows = db.prepare("SELECT entity_id, is_discord, badge_key, unlock_count FROM entity_badges").all();
    if (!rows.length) return interaction.reply("🤷 Aucun badge n'a été débloqué pour le moment.");

    const grouped = {};
    for (const row of rows) {
      let nameLabel = row.entity_id;
      if (row.is_discord) {
        nameLabel = `<@${row.entity_id}>`;
      } else {
        const p = db.prepare("SELECT game_name, tag_line FROM players WHERE puuid = ?").get(row.entity_id);
        if (p) nameLabel = `**${p.game_name}#${p.tag_line}**`;
      }
      if (!grouped[nameLabel]) grouped[nameLabel] = [];
      const badgeCfg = BADGES.find((b) => b.key === row.badge_key);
      const label = badgeCfg ? `${badgeCfg.name} (${badgeCfg.rank})` : row.badge_key;
      grouped[nameLabel].push(`${label}${row.unlock_count > 1 ? ` (x${row.unlock_count})` : ""}`);
    }

    let message = "🏆 **RÉCAPITULATIF DES BADGES** 🏆\n━━━━━━━━━━━━━━━━━━━━━━━━\n";
    for (const [player, badges] of Object.entries(grouped)) {
      message += `👤 ${player}\n🎖️ ${badges.join(", ")}\n\n`;
    }
    message += "━━━━━━━━━━━━━━━━━━━━━━━━";
    await interaction.reply(message);
  }
};
