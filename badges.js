const BADGES = [
  // --- BRONZE ---
  {
    key: "5L",
    name: "Jamais 4 sans 5",
    description: "Atteindre une série de 5 défaites",
    rank: "Bronze",
    repeatable: true,
    trigger: ({ streak }) => streak === 5,
  },
  {
    key: "VICTIME_BRONZE",
    name: "Victime",
    description: "Mourir plus de 12 fois dans une partie",
    rank: "Bronze",
    repeatable: true,
    trigger: ({ participant }) => participant.deaths > 12 && participant.deaths < 17,
  },
  {
    key: "KDA_PLAYER_BRONZE",
    name: "KDA Player",
    description: "Perdre sans mourir avec au moins 5 Kills/Assists",
    rank: "Bronze",
    repeatable: true,
    trigger: ({ participant }) => participant.deaths === 0 && (participant.kills + participant.assists) >= 5 && (participant.kills + participant.assists) < 10,
  },
  {
    key: "EGOISTE_BRONZE",
    name: "L'Égoïste",
    description: "Perdre avec 0 assist et au moins 5 kills",
    rank: "Bronze",
    repeatable: true,
    trigger: ({ participant }) => participant.assists === 0 && participant.kills >= 5 && participant.kills < 10,
  },

  // --- ARGENT ---
  {
    key: "10L",
    name: "La chute libre",
    description: "Atteindre une série de 10 défaites",
    rank: "Argent",
    repeatable: true,
    trigger: ({ streak }) => streak === 10,
  },
  {
    key: "VICTIME_SILVER",
    name: "Victime (Argent)",
    description: "Mourir 17 fois ou plus dans une partie",
    rank: "Argent",
    repeatable: true,
    trigger: ({ participant }) => participant.deaths >= 17 && participant.deaths < 20,
  },
  {
    key: "KDA_PLAYER_SILVER",
    name: "KDA Player (Argent)",
    description: "Perdre sans mourir avec au moins 10 Kills/Assists",
    rank: "Argent",
    repeatable: true,
    trigger: ({ participant }) => participant.deaths === 0 && (participant.kills + participant.assists) >= 10 && (participant.kills + participant.assists) < 20,
  },
  {
    key: "EGOISTE_SILVER",
    name: "L'Égoïste (Argent)",
    description: "Perdre avec 0 assist et au moins 10 kills",
    rank: "Argent",
    repeatable: true,
    trigger: ({ participant }) => participant.assists === 0 && participant.kills >= 10 && participant.kills < 15,
  },
  {
    key: "PACIFISTE",
    name: "Pacifiste",
    description: "Perdre une partie de plus de 15 min avec moins de 3000 dégâts",
    rank: "Argent",
    repeatable: true,
    trigger: ({ participant, gameDuration }) => gameDuration > 900 && participant.totalDamageDealtToChampions < 3000,
  },
  {
    key: "AVEUGLE",
    name: "L'Aveugle",
    description: "Perdre une partie de plus de 25 min avec < 5 de score de vision",
    rank: "Argent",
    repeatable: true,
    trigger: ({ participant, gameDuration }) => gameDuration > 1500 && participant.visionScore < 5,
  },
  {
    key: "VOLEUR",
    name: "Le Voleur d'Objectif",
    description: "Voler un objectif épique mais perdre",
    rank: "Argent",
    repeatable: true,
    trigger: ({ participant }) => participant.objectivesStolen > 0,
  },

  // --- OR ---
  {
    key: "15L",
    name: "Le fond du gouffre",
    description: "Atteindre une série de 15 défaites",
    rank: "Or",
    repeatable: true,
    trigger: ({ streak }) => streak === 15,
  },
  {
    key: "VICTIME_GOLD",
    name: "Victime (Or)",
    description: "Mourir 20 fois ou plus dans une partie",
    rank: "Or",
    repeatable: true,
    trigger: ({ participant }) => participant.deaths >= 20,
  },
  {
    key: "KDA_PLAYER_GOLD",
    name: "KDA Player (Or)",
    description: "Perdre sans mourir avec au moins 20 Kills/Assists",
    rank: "Or",
    repeatable: true,
    trigger: ({ participant }) => participant.deaths === 0 && (participant.kills + participant.assists) >= 20,
  },
  {
    key: "EGOISTE_GOLD",
    name: "L'Égoïste (Or)",
    description: "Perdre avec 0 assist et au moins 15 kills",
    rank: "Or",
    repeatable: true,
    trigger: ({ participant }) => participant.assists === 0 && participant.kills >= 15,
  },
  {
    key: "PROMENEUR",
    name: "Le Promeneur",
    description: "Perdre une partie de plus de 20 min avec moins de 5000 golds",
    rank: "Or",
    repeatable: true,
    trigger: ({ participant, gameDuration }) => gameDuration > 1200 && participant.goldEarned < 5000,
  },
  {
    key: "SAC_A_PV",
    name: "Gros sac à PV",
    description: "Subir plus de 60 000 dégâts",
    rank: "Or",
    repeatable: true,
    trigger: ({ participant }) => participant.totalDamageTaken > 60000,
  },

  // --- SECRET ---
  {
    key: "PENTA_LOSE",
    name: "Penta-Lose",
    description: "Faire un Pentakill mais perdre",
    rank: "Secret",
    repeatable: true,
    trigger: ({ participant }) => participant.pentaKills > 0,
  },
  {
    key: "POWERSPIKE_0_10_0",
    name: "Powerspike 0/10/0",
    description: "Faire 0/10/0 sur n'importe quel champion",
    rank: "Secret",
    repeatable: true,
    trigger: ({ participant }) => participant.kills === 0 && participant.deaths === 10 && participant.assists === 0,
  },
  {
    key: "FARMING_SIMULATOR",
    name: "Farming Simulator",
    description: "Tuer plus de 300 sbires et perdre",
    rank: "Secret",
    repeatable: true,
    trigger: ({ participant }) => (participant.totalMinionsKilled + participant.neutralMinionsKilled) > 300,
  },
  {
    key: "BUCHERON",
    name: "Le Bûcheron",
    description: "Participer à la destruction de 11 tourelles et perdre",
    rank: "Secret",
    repeatable: true,
    trigger: ({ participant }) => participant.turretTakedowns >= 11,
  },
  {
    key: "SPEEDRUN_DEFEAT",
    name: "Speedrun Any% (Defeat)",
    description: "Perdre en moins de 16 minutes",
    rank: "Secret",
    repeatable: true,
    trigger: ({ gameDuration }) => gameDuration < 960,
  },
];

function evaluateTriggeredBadges(participant, streak, gameDuration) {
  return BADGES.filter((badge) => badge.trigger({ participant, streak, gameDuration }));
}

module.exports = {
  BADGES,
  evaluateTriggeredBadges,
};
