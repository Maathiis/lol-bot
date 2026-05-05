const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { db } = require("../database");
const { registerBadgeUnlock } = require("../services/matchChecker");
const { BADGES } = require("../../badges");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("badge-add")
    .setDescription("Donner un badge manuellement (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("discord")
        .setDescription("Ajouter un badge à un compte Discord")
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
        .setDescription("Ajouter un badge à un compte LoL")
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

    const badge = BADGES.find((b) => b.key === badgeKey);
    if (!badge)
      return interaction.reply({
        content: `❌ Le badge **${badgeKey}** n'existe pas.`,
        ephemeral: true,
      });

    let entityId, isDiscord, label;
    if (subcommand === "discord") {
      const discordUser = interaction.options.getUser("utilisateur");
      entityId = discordUser.id;
      isDiscord = 1;
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
      isDiscord = 0;
      label = `le compte LoL **${player.game_name}#${player.tag_line}**`;
    }

    const unlock = registerBadgeUnlock(entityId, isDiscord, badge);

    await interaction.reply(
      `✅ Badge **${badge.name}** ajouté à ${label}. (Total: ${unlock.unlockCount})`,
    );
  },
};
