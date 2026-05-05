const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("badge-remove")
    .setDescription("Retirer un badge manuellement (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("discord")
        .setDescription("Retirer un badge d'un compte Discord")
        .addUserOption((opt) =>
          opt.setName("utilisateur").setDescription("Utilisateur Discord").setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("badge")
            .setDescription("Clé du badge")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("lol")
        .setDescription("Retirer un badge d'un compte LoL")
        .addStringOption((opt) =>
          opt
            .setName("joueur")
            .setDescription("Compte LoL")
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
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const badgeKey = interaction.options.getString("badge");

    let entityId, label;
    if (subcommand === "discord") {
      const discordUser = interaction.options.getUser("utilisateur");
      entityId = discordUser.id;
      label = `l'utilisateur Discord **${discordUser.displayName || discordUser.username}**`;
    } else if (subcommand === "lol") {
      const lolUser = interaction.options.getString("joueur");
      const player = db
        .prepare("SELECT puuid, game_name, tag_line FROM players WHERE puuid = ?")
        .get(lolUser);
      if (!player)
        return interaction.reply({
          content: "❌ Joueur introuvable.",
          ephemeral: true,
        });
      entityId = player.puuid;
      label = `le compte LoL **${player.game_name}#${player.tag_line}**`;
    }

    const result = db
      .prepare("DELETE FROM entity_badges WHERE entity_id = ? AND badge_key = ?")
      .run(entityId, badgeKey);

    if (result.changes === 0)
      return interaction.reply({
        content: `❌ **${label}** n'a pas le badge **${badgeKey}**.`,
        ephemeral: true,
      });
    await interaction.reply(`✅ Badge **${badgeKey}** retiré de ${label}.`);
  },
};
