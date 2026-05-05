const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("badge-remove")
    .setDescription("Retirer un badge manuellement (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt.setName("joueur").setDescription("Joueur").setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName("badge").setDescription("Clé du badge").setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName("cible").setDescription("Cible").setRequired(true).addChoices({name: "Compte Discord", value: "discord"}, {name: "Compte LoL", value: "lol"})),
  async execute(interaction) {
    const puuid = interaction.options.getString("joueur");
    const badgeKey = interaction.options.getString("badge");
    const cible = interaction.options.getString("cible");

    const player = db.prepare("SELECT game_name, tag_line, discord_user_id, puuid FROM players WHERE puuid = ?").get(puuid);
    if (!player) return interaction.reply({ content: "❌ Joueur introuvable.", ephemeral: true });

    let entityId;
    if (cible === "discord") {
      if (!player.discord_user_id) return interaction.reply({ content: `❌ Le joueur **${player.game_name}#${player.tag_line}** n'a pas de compte Discord lié.`, ephemeral: true });
      entityId = player.discord_user_id;
    } else {
      entityId = player.puuid;
    }
    
    const result = db.prepare("DELETE FROM entity_badges WHERE entity_id = ? AND badge_key = ?").run(entityId, badgeKey);

    if (result.changes === 0) return interaction.reply({ content: `❌ L'entité liée n'a pas le badge **${badgeKey}**.`, ephemeral: true });
    await interaction.reply(`✅ Badge **${badgeKey}** retiré.`);
  }
};
