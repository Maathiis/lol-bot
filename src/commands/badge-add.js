const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { db } = require("../database");
const { registerBadgeUnlock } = require("../services/matchChecker");
const { BADGES } = require("../../badges");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("badge-add")
    .setDescription("Donner un badge manuellement (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt.setName("joueur").setDescription("Joueur").setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName("badge").setDescription("Clé du badge").setRequired(true).setAutocomplete(true)),
  async execute(interaction) {
    const puuidArg = interaction.options.getString("joueur");
    const badgeKey = interaction.options.getString("badge");

    const player = db.prepare("SELECT puuid, game_name, tag_line, discord_user_id FROM players WHERE puuid = ?").get(puuidArg);
    if (!player) return interaction.reply({ content: "❌ Joueur introuvable.", ephemeral: true });

    const badge = BADGES.find((b) => b.key === badgeKey);
    if (!badge) return interaction.reply({ content: `❌ Le badge **${badgeKey}** n'existe pas.`, ephemeral: true });

    const entityId = player.discord_user_id || player.puuid;
    const isDiscord = player.discord_user_id ? 1 : 0;
    const unlock = registerBadgeUnlock(entityId, isDiscord, badge);

    await interaction.reply(`✅ Badge **${badge.name}** ajouté à l'entité liée à **${player.game_name}#${player.tag_line}**. (Total: ${unlock.unlockCount})`);
  }
};
