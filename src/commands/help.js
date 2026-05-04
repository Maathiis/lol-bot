const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Lister toutes les commandes disponibles"),
  async execute(interaction) {
    const commands = interaction.client.commands;
    
    let userCommands = [];
    let adminCommands = [];

    // On parcourt toutes les commandes chargées dans le bot
    commands.forEach((cmd) => {
      const data = cmd.data;
      
      // On vérifie si la commande a des permissions par défaut et si cette permission inclut "Administrator"
      // PermissionFlagsBits.Administrator vaut 8
      const isAdminCommand = data.default_member_permissions?.bitfield === PermissionFlagsBits.Administrator || 
                             data.default_member_permissions?.toString() === PermissionFlagsBits.Administrator.toString();
                             
      let description = data.description;
      
      // Si on a déjà mis "(Admin)" dans la description, on peut l'enlever pour que ça soit plus propre vu qu'on va les classer
      description = description.replace(" (Admin)", "");

      const entry = `**/${data.name}** - ${description}`;

      if (isAdminCommand || data.name === "synchronisation" || data.name === "versions") {
        adminCommands.push(entry);
      } else {
        userCommands.push(entry);
      }
    });

    const embed = {
      title: "📖 Liste des Commandes",
      color: 0x5865F2, // Couleur bleue Blurple de Discord
      description: "Voici l'ensemble des commandes disponibles sur le bot :",
      fields: [
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
      ],
      footer: {
        text: "Utilisez / pour exécuter une commande"
      }
    };

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
