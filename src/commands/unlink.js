const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { db } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Délier un joueur LoL de son compte Discord (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt.setName("joueur").setDescription("Joueur à délier").setRequired(true).setAutocomplete(true)),
  async execute(interaction) {
    const identifiant = interaction.options.getString("joueur");
    const player = db.prepare("SELECT puuid, game_name, tag_line, discord_user_id FROM accounts WHERE puuid = ? OR game_name = ?").get(identifiant, identifiant);

    if (!player) return interaction.reply({ content: `❌ Joueur introuvable dans le suivi : **${identifiant}**`, ephemeral: true });
    if (!player.discord_user_id) return interaction.reply({ content: `❌ Le joueur **${player.game_name}#${player.tag_line}** n'est lié à aucun compte Discord.`, ephemeral: true });

    const oldUserId = player.discord_user_id;
    db.prepare("UPDATE accounts SET discord_user_id = NULL WHERE puuid = ?").run(player.puuid);
    
    const embed = new EmbedBuilder()
      .setTitle("🔓 Liaison rompue")
      .setColor(0xe67e22)
      .setDescription(`Le compte **${player.game_name}#${player.tag_line}** a été délié.`)
      .addFields({ name: "Ancien lien", value: `<@${oldUserId}>` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
