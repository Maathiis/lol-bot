const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Lister toutes les commandes disponibles"),
  async execute(interaction) {
    const commands = interaction.client.commands;
    
    let userCommands = [];
    let adminCommands = [];

    commands.forEach((cmd) => {
      const data = cmd.data;
      const isAdminCommand = data.default_member_permissions?.bitfield === PermissionFlagsBits.Administrator || 
                             data.default_member_permissions?.toString() === PermissionFlagsBits.Administrator.toString();
                             
      let description = data.description.replace(" (Admin)", "");
      const entry = `**/${data.name}** - ${description}`;

      if (isAdminCommand || ["synchronisation", "versions", "clear", "remove", "add", "badge-add", "badge-remove"].includes(data.name)) {
        adminCommands.push(entry);
      } else {
        userCommands.push(entry);
      }
    });

    const embed = new EmbedBuilder()
      .setTitle("📖 Liste des Commandes")
      .setColor(0x5865F2)
      .setDescription("Voici l'ensemble des commandes disponibles sur le bot :")
      .addFields(
        {
          name: "👤 Commandes Publiques",
          value: userCommands.length > 0 ? userCommands.join("\n") : "Aucune",
          inline: false
        },
        {
          name: "🛡️ Commandes Administrateurs",
          value: adminCommands.length > 0 ? adminCommands.join("\n") : "Aucune",
          inline: false
        }
      )
      .setFooter({ text: "Utilisez / pour exécuter une commande" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
