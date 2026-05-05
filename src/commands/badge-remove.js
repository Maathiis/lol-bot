const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("badge-remove")
    .setDescription("Retirer un badge manuellement à un compte LoL (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName("joueur")
        .setDescription("Compte LoL (Pseudo#Tag ou PUUID)")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("badge")
        .setDescription("Clé du badge")
        .setRequired(true)
        .setAutocomplete(true),
    ),
  async execute(interaction) {
    const lolUser = interaction.options.getString("joueur");
    const badgeKey = interaction.options.getString("badge");

    const player = db.prepare("SELECT puuid, game_name, tag_line FROM accounts WHERE puuid = ? OR game_name = ?").get(lolUser, lolUser);
    if (!player) return interaction.reply({ content: "❌ Compte LoL introuvable dans la base du bot.", ephemeral: true });

    const result = db.prepare("DELETE FROM badges WHERE entity_id = ? AND badge_key = ?").run(player.puuid, badgeKey);

    if (result.changes === 0)
      return interaction.reply({
        content: `❌ **${player.game_name}#${player.tag_line}** n'a pas le badge \`${badgeKey}\`.`,
        ephemeral: true,
      });

    const embed = new EmbedBuilder()
      .setTitle("🗑️ Badge retiré")
      .setColor(0xe67e22)
      .setDescription(`Le badge \`${badgeKey}\` a été retiré de **${player.game_name}#${player.tag_line}**.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
