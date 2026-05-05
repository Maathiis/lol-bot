const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
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

      db.prepare("INSERT OR IGNORE INTO accounts (puuid, game_name, tag_line, discord_user_id) VALUES (?, ?, ?, ?)").run(puuid, gameName, tagLine, discordUser ? discordUser.id : null);
      if (discordUser) {
        db.prepare("UPDATE accounts SET discord_user_id = ? WHERE puuid = ?").run(discordUser.id, puuid);
      }
      db.prepare(`
        INSERT INTO guild_tracking (puuid, channel_id, guild_id) 
        VALUES (?, ?, ?) 
        ON CONFLICT(puuid, channel_id) DO UPDATE SET guild_id = excluded.guild_id
      `).run(puuid, interaction.channelId, interaction.guildId);

      const embed = new EmbedBuilder()
        .setTitle("✅ Joueur ajouté")
        .setColor(0x00ff00)
        .setDescription(`Le compte **${gameName}#${tagLine}** est maintenant sous surveillance.`)
        .addFields({ name: "Lien Discord", value: discordUser ? `${discordUser}` : "Aucun", inline: true })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      await interaction.editReply({ content: "❌ Impossible de trouver ce compte Riot. Vérifiez le pseudo et le tag.", ephemeral: true });
    }
  }
};
