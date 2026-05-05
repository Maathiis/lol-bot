const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("versions")
    .setDescription("Voir la version actuelle du bot et ses nouveautés"),
  async execute(interaction) {
    const version = "1.0.0";
    const V1_0_0 = `- 🚀 Refonte complète de l'architecture du bot.
- ✨ Nouveau système de badges avec 3 rangs de rareté (Bronze 🥉, Argent 🥈, Or 🥇).
- 📊 Les statistiques et les badges sont maintenant fusionnés par compte Discord (gère le multicomptes).
- 📅 Nouveau système de classement mensuel des défaites.
- ⚙️ Nouvelles commandes de gestion et ajout d'un système de sauvegarde.`;

    const message = `⚙️ **VERSION DU BOT : V${version}** ⚙️\n━━━━━━━━━━━━━━━━━━━━━━━━\n📝 **Nouveautés :**\n${V1_0_0}\n━━━━━━━━━━━━━━━━━━━━━━━━`;

    await interaction.reply({ content: message, ephemeral: false });
  },
};
