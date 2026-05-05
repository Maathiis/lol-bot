const axios = require("axios");

const RIOT_API_KEY = process.env.RIOT_API_KEY ? process.env.RIOT_API_KEY.trim() : "";

const QUEUE_TYPES = {
  400: "Draft Normale",
  420: "Ranked Solo",
  430: "Blind Pick",
  440: "Ranked Flex",
  450: "ARAM",
  480: "Swiftplay",
  490: "Quickplay",
  700: "Clash",
  720: "ARAM Clash",
  1700: "Arena",
  1710: "Arena (16p)",
  1900: "URF",
  2400: "ARAM Chaos",
};

/**
 * Récupère le rank et les LP d'un joueur via l'API Riot (by-puuid).
 * @param {string} puuid - Le PUUID du joueur
 * @param {number} queueId - L'ID de la queue (420 = Solo, 440 = Flex)
 * @returns {Promise<{tier: string, rank: string, lp: number} | null>}
 */
async function fetchPlayerRank(puuid, queueId) {
  if (queueId !== 420 && queueId !== 440) return null;

  try {
    const axiosConfig = { headers: { "X-Riot-Token": RIOT_API_KEY } };
    const url = `https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
    const leagueRes = await axios.get(url, axiosConfig);

    const queueType = queueId === 440 ? "RANKED_FLEX_SR" : "RANKED_SOLO_5x5";
    const entry = leagueRes.data.find((e) => e.queueType === queueType);

    if (!entry) return null;

    return {
      tier: entry.tier,
      rank: entry.rank,
      lp: entry.leaguePoints,
    };
  } catch (e) {
    if (e.response?.status === 403) {
      console.error("❌ Erreur 403 Riot API : Vérifiez si votre clé est bien à jour sur le portail.");
    } else {
      console.error(`⚠️ Impossible de récupérer le rank (${puuid}) : ${e.message}`);
    }
    return null;
  }
}

let championsCache = null;

async function getChampionName(championId) {
  if (!championsCache) {
    try {
      const vRes = await axios.get("https://ddragon.leagueoflegends.com/api/versions.json");
      const v = vRes.data[0];
      const cRes = await axios.get(`https://ddragon.leagueoflegends.com/cdn/${v}/data/fr_FR/champion.json`);
      championsCache = cRes.data.data;
    } catch (e) {
      return "Inconnu";
    }
  }
  for (const key in championsCache) {
    if (championsCache[key].key == championId) {
      return championsCache[key].name;
    }
  }
  return "Inconnu";
}

module.exports = {
  RIOT_API_KEY,
  QUEUE_TYPES,
  fetchPlayerRank,
  getChampionName,
};
