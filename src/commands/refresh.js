const { SlashCommandBuilder } = require("discord.js");
const { checkMatches } = require("../services/matchChecker");

module.exports = {
  data: new SlashCommandBuilder().setName("refresh").setDescription("Forcer une vérification immédiate des matchs"),
  async execute(interaction) {
    await interaction.deferReply();
    await checkMatches(interaction.client);
    await interaction.editReply("✅ Vérification terminée.");
  }
};
