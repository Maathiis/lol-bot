const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const axios = require("axios");
const { db } = require("../database");
const { RIOT_API_KEY } = require("../services/riot");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("add")
    .setDescription("Ajouter un joueur (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt.setName("nom").setDescription("Pseudo").setRequired(true))
    .addStringOption(opt => opt.setName("tag").setDescription("Tag").setRequired(true))
    .addUserOption(opt => opt.setName("discord").setDescription("Compte Discord à lier (optionnel)").setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply();
    const nom = interaction.options.getString("nom");
    const tag = interaction.options.getString("tag");
    const discordUser = interaction.options.getUser("discord");

    try {
      const accRes = await axios.get(
        `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${nom}/${tag}`,
        { headers: { "X-Riot-Token": RIOT_API_KEY } }
      );
      const { puuid, gameName, tagLine } = accRes.data;

      db.prepare("INSERT OR IGNORE INTO players (puuid, game_name, tag_line, discord_user_id) VALUES (?, ?, ?, ?)").run(puuid, gameName, tagLine, discordUser ? discordUser.id : null);
      if (discordUser) {
        db.prepare("UPDATE players SET discord_user_id = ? WHERE puuid = ?").run(discordUser.id, puuid);
      }
      db.prepare("INSERT OR IGNORE INTO subscriptions (puuid, channel_id) VALUES (?, ?)").run(puuid, interaction.channelId);

      await interaction.editReply(discordUser ? `✅ **${gameName}#${tagLine}** est sous surveillance ici, lié à ${discordUser}.` : `✅ **${gameName}#${tagLine}** est maintenant sous surveillance ici.`);
    } catch (e) {
      await interaction.editReply("❌ Introuvable.");
    }
  }
};
