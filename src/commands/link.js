const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Lier un joueur LoL à un compte Discord (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt.setName("joueur").setDescription("Joueur à lier").setRequired(true).setAutocomplete(true))
    .addUserOption(opt => opt.setName("discord").setDescription("Utilisateur Discord").setRequired(true)),
  async execute(interaction) {
    const identifiant = interaction.options.getString("joueur");
    const discordUser = interaction.options.getUser("discord");
    const player = db.prepare("SELECT puuid, game_name, tag_line FROM players WHERE puuid = ? OR game_name = ?").get(identifiant, identifiant);

    if (!player) return interaction.reply({ content: `❌ Joueur introuvable dans le suivi: **${identifiant}**`, ephemeral: true });

    db.prepare("UPDATE players SET discord_user_id = ? WHERE puuid = ?").run(discordUser.id, player.puuid);
    await interaction.reply(`🔗 **${player.game_name}#${player.tag_line}** est maintenant lié à ${discordUser}.`);
  }
};
