const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Retirer le lien Discord d'un joueur LoL (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt.setName("joueur").setDescription("Joueur à délier").setRequired(true).setAutocomplete(true)),
  async execute(interaction) {
    const identifiant = interaction.options.getString("joueur");
    const player = db.prepare("SELECT puuid, game_name, tag_line, discord_user_id FROM players WHERE puuid = ? OR game_name = ?").get(identifiant, identifiant);

    if (!player) return interaction.reply({ content: `❌ Joueur introuvable : **${identifiant}**`, ephemeral: true });
    if (!player.discord_user_id) return interaction.reply({ content: `❌ Le joueur **${player.game_name}#${player.tag_line}** n'est lié à aucun compte Discord.`, ephemeral: true });

    db.prepare("UPDATE players SET discord_user_id = NULL WHERE puuid = ?").run(player.puuid);
    let name = player.discord_user_id;
    try {
      const user = interaction.client.users.cache.get(player.discord_user_id) || await interaction.client.users.fetch(player.discord_user_id);
      name = user.globalName || user.username;
    } catch {}
    await interaction.reply(`🔗 **${player.game_name}#${player.tag_line}** a été dissocié du compte Discord **${name}**.`);
  }
};
