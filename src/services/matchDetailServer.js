const http = require("http");
const axios = require("axios");
const { RIOT_API_KEY, getDdragonVersion } = require("./riot");

const PORT = parseInt(process.env.MATCH_API_PORT || "3717", 10);
const REGIONAL_HOST = "https://europe.api.riotgames.com";

/** Récupère les détails complets d'une partie depuis Riot Match-V5. */
async function fetchMatchDetail(matchId) {
  const res = await axios.get(`${REGIONAL_HOST}/lol/match/v5/matches/${matchId}`, {
    headers: { "X-Riot-Token": RIOT_API_KEY },
  });

  const info = res.data.info;
  const v = await getDdragonVersion();

  const participants = info.participants.map((p) => ({
    puuid: p.puuid,
    summonerName: p.riotIdGameName ?? p.summonerName ?? "Invocateur",
    championName: p.championName,
    championIconUrl: `https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${p.championName}.png`,
    teamId: p.teamId,
    teamPosition: p.teamPosition,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    totalDamageDealtToChampions: p.totalDamageDealtToChampions,
    goldEarned: p.goldEarned,
    totalMinionsKilled: p.totalMinionsKilled + (p.neutralMinionsKilled ?? 0),
    visionScore: p.visionScore,
    champLevel: p.champLevel,
    win: p.win,
    items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
    killParticipation: p.challenges?.killParticipation ?? null,
    teamDamagePercentage: p.challenges?.teamDamagePercentage ?? null,
    pentaKills: p.pentaKills ?? 0,
  }));

  return {
    matchId,
    gameDuration: info.gameDuration,
    queueId: info.queueId,
    gameEndTimestamp: info.gameEndTimestamp,
    participants,
  };
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "http://localhost:3000",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function startMatchDetailServer() {
  if (!RIOT_API_KEY) {
    console.warn("⚠️  RIOT_API_KEY manquante — serveur match-detail non démarré.");
    return;
  }

  const server = http.createServer(async (req, res) => {
    if (req.method !== "GET") { send(res, 405, { error: "Method not allowed" }); return; }

    const match = req.url?.match(/^\/match\/([A-Z0-9]+_\d+)$/);
    if (!match) { send(res, 404, { error: "Not found" }); return; }

    const matchId = match[1];
    try {
      const detail = await fetchMatchDetail(matchId);
      send(res, 200, detail);
    } catch (e) {
      const status = e.response?.status ?? 500;
      console.error(`match-detail ${matchId}: ${e.message}`);
      send(res, status, { error: e.message });
    }
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`🌐 Serveur match-detail sur http://127.0.0.1:${PORT}`);
  });

  return server;
}

module.exports = { startMatchDetailServer };
