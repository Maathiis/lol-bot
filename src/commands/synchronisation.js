const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const axios = require("axios");
const { db } = require("../database");
const { RIOT_API_KEY } = require("../services/riot");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("synchronisation")
    .setDescription("Synchroniser les PUUID avec la clé API actuelle (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    await interaction.deferReply();
    const players = db.prepare("SELECT * FROM players").all();
    for (const player of players) {
      try {
        const res = await axios.get(`https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${player.game_name}/${player.tag_line}`, { headers: { "X-Riot-Token": RIOT_API_KEY } });
        const newPuuid = res.data.puuid;
        if (newPuuid && newPuuid !== player.puuid) {
          db.prepare("UPDATE subscriptions SET puuid = ? WHERE puuid = ?").run(newPuuid, player.puuid);
          db.prepare("UPDATE players SET puuid = ? WHERE puuid = ?").run(newPuuid, player.puuid);
        }
      } catch (e) {}
    }
    await interaction.editReply("✅ Synchronisation des PUUID terminée.");
  }
};
