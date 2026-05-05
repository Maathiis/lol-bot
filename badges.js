const BADGES = [
  // --- BRONZE ---
  {
    key: "5L",
    name: "Jamais 4 sans 5",
    description: "Atteindre une série de 5 défaites",
    rank: "Bronze",
    version: 1,
    repeatable: true,
    trigger: ({ streak }) => streak === 5,
  },
  {
    key: "VICTIME_BRONZE",
    name: "Victime",
    description: "Mourir plus de 12 fois dans une partie",
    rank: "Bronze",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) =>
      participant.deaths > 12 && participant.deaths < 17,
  },
  {
    key: "KDA_PLAYER_BRONZE",
    name: "KDA Player",
    description: "Perdre sans mourir avec au moins 5 Kills/Assists",
    rank: "Bronze",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) =>
      participant.deaths === 0 &&
      participant.kills + participant.assists >= 5 &&
      participant.kills + participant.assists < 10,
  },
  {
    key: "EGOISTE_BRONZE",
    name: "L'Égoïste",
    description: "Perdre avec 0 assist et au moins 5 kills",
    rank: "Bronze",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) =>
      participant.assists === 0 &&
      participant.kills >= 5 &&
      participant.kills < 10,
  },

  // --- ARGENT ---
  {
    key: "10L",
    name: "La chute libre",
    description: "Atteindre une série de 10 défaites",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ streak }) => streak === 10,
  },
  {
    key: "VICTIME_SILVER",
    name: "Victime (Argent)",
    description: "Mourir 17 fois ou plus dans une partie",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) =>
      participant.deaths >= 17 && participant.deaths < 20,
  },
  {
    key: "KDA_PLAYER_SILVER",
    name: "KDA Player (Argent)",
    description: "Perdre sans mourir avec au moins 10 Kills/Assists",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) =>
      participant.deaths === 0 &&
      participant.kills + participant.assists >= 10 &&
      participant.kills + participant.assists < 20,
  },
  {
    key: "EGOISTE_SILVER",
    name: "L'Égoïste (Argent)",
    description: "Perdre avec 0 assist et au moins 10 kills",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) =>
      participant.assists === 0 &&
      participant.kills >= 10 &&
      participant.kills < 15,
  },
  {
    key: "PACIFISTE",
    name: "Pacifiste",
    description:
      "Perdre une partie de plus de 15 min avec moins de 3000 dégâts",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ participant, gameDuration }) =>
      gameDuration > 900 && participant.totalDamageDealtToChampions < 3000,
  },
  {
    key: "AVEUGLE",
    name: "L'Aveugle",
    description:
      "Perdre une partie de plus de 25 min avec < 5 de score de vision",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ participant, gameDuration }) =>
      gameDuration > 1500 && participant.visionScore < 5,
  },
  {
    key: "VOLEUR",
    name: "Le Voleur d'Objectif",
    description: "Voler un objectif épique mais perdre",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) => participant.objectivesStolen > 0,
  },
  {
    key: "MINEUR_DE_FOND",
    name: "Le Mineur de Fond",
    description:
      "Passer la partie dans sa jungle/lane sans jamais croiser d'ennemi",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) =>
      (participant.challenges?.enemyJungleMonsterKills || 0) < 2 &&
      participant.totalDamageDealtToChampions < 5000,
  },
  {
    key: "GABRIEL_PERI",
    name: "Le Périphérique",
    description: "Faire le tour de la map sans participer aux combats",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) =>
      (participant.challenges?.teamDamagePercentage || 0) < 0.1 &&
      (participant.challenges?.killParticipation || 0) < 0.15,
  },
  {
    key: "COLLECTIONNEUR_DE_GRIS",
    name: "Écran Noir & Blanc",
    description: "Passer plus de 5 minutes cumulées à attendre de réapparaître",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) => participant.totalTimeSpentDead > 300,
  },
  {
    key: "FULL_STUFF_LOSE",
    name: "Le Banquier Inutile",
    description: "Perdre en ayant plus de 3000 golds en poche non dépensés",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) =>
      participant.goldEarned - participant.goldSpent > 3000,
  },
  {
    key: "SMITE_DE_PANIQUE",
    name: "Smite de Panique",
    description:
      "Se faire voler un objectif alors que le Smite était disponible",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ participant, opponentTeamStats }) =>
      participant.teamPosition === "JUNGLE" &&
      opponentTeamStats.participants.some(
        (op) => (op.challenges?.epicMonsterSteals || 0) > 0,
      ),
  },
  {
    key: "ARAM_BANKER",
    name: "Banquier de l'Abîme",
    description: "Perdre un ARAM avec plus de 3000 golds en poche",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ participant, info }) =>
      info.gameMode === "ARAM" &&
      participant.goldEarned - participant.goldSpent > 3000,
  },
  {
    key: "ARAM_SNOWBALL",
    name: "Tir aux Pigeons",
    description: "Toucher 15+ boules de neige dans un ARAM et perdre",
    rank: "Argent",
    version: 1,
    repeatable: true,
    trigger: ({ participant, info }) =>
      info.gameMode === "ARAM" && (participant.challenges?.snowballHit || 0) >= 15,
  },

  // --- OR ---
  {
    key: "15L",
    name: "Le fond du gouffre",
    description: "Atteindre une série de 15 défaites",
    rank: "Or",
    version: 1,
    repeatable: true,
    trigger: ({ streak }) => streak === 15,
  },
  {
    key: "VICTIME_GOLD",
    name: "Victime (Or)",
    description: "Mourir 20 fois ou plus dans une partie",
    rank: "Or",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) => participant.deaths >= 20,
  },
  {
    key: "KDA_PLAYER_GOLD",
    name: "KDA Player (Or)",
    description: "Perdre sans mourir avec au moins 20 Kills/Assists",
    rank: "Or",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) =>
      participant.deaths === 0 && participant.kills + participant.assists >= 20,
  },
  {
    key: "EGOISTE_GOLD",
    name: "L'Égoïste (Or)",
    description: "Perdre avec 0 assist et au moins 15 kills",
    rank: "Or",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) =>
      participant.assists === 0 && participant.kills >= 15,
  },
  {
    key: "PROMENEUR",
    name: "Le Promeneur",
    description: "Perdre une partie de plus de 20 min avec moins de 5000 golds",
    rank: "Or",
    version: 1,
    repeatable: true,
    trigger: ({ participant, gameDuration }) =>
      gameDuration > 1200 && participant.goldEarned < 5000,
  },
  {
    key: "SAC_A_PV",
    name: "Gros sac à PV",
    description: "Subir plus de 60 000 dégâts",
    rank: "Or",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) => participant.totalDamageTaken > 60000,
  },
  {
    key: "ICARE_SYNDROME",
    name: "Le Syndrome d'Icare",
    description: "Perdre avec 4000 golds d'avance sur votre vis-à-vis",
    rank: "Or",
    version: 1,
    repeatable: true,
    trigger: ({ participant, opponentDirect }) =>
      opponentDirect &&
      participant.goldEarned - opponentDirect.goldEarned > 4000,
  },
  {
    key: "TOP_GAP_HELL",
    name: "Top Gap des Enfers",
    description:
      "Perdre alors que le Top adverse a pris l'inhibiteur et 3+ tours",
    rank: "Or",
    version: 1,
    repeatable: true,
    trigger: ({ participant, opponentTop }) =>
      participant.teamPosition === "TOP" &&
      opponentTop &&
      opponentTop.inhibitorTakedowns >= 1 &&
      opponentTop.turretTakedowns >= 3,
  },
  {
    key: "LIFE_INSURANCE",
    name: "L'Assurance Vie",
    description: "Perdre avec un Ange Gardien ou Chronomètre en inventaire",
    rank: "Or",
    version: 1,
    repeatable: true,
    trigger: ({ participant }) => {
      const items = [
        participant.item0,
        participant.item1,
        participant.item2,
        participant.item3,
        participant.item4,
        participant.item5,
      ];
      const hasSafeItem = items.some((id) =>
        [3026, 2420, 2421, 6029].includes(id),
      );
      return hasSafeItem;
    },
  },
  {
    key: "ARAM_PUNCHING_BALL",
    name: "Punching Ball",
    description: "Subir plus de 50 000 dégâts dans un ARAM et perdre",
    rank: "Or",
    version: 1,
    repeatable: true,
    trigger: ({ participant, info }) =>
      info.gameMode === "ARAM" && participant.totalDamageTaken > 50000,
  },

  // --- PLATINE ---
  {
    key: "COLLECTOR_GEN1",
    name: "Collectionneur G1",
    description: "Avoir débloqué tous les badges de la 1ère génération",
    rank: "Platine",
    repeatable: false,
    trigger: ({ ownedBadgeKeys }) => {
      const v1BadgeKeys = BADGES.filter(b => b.version === 1).map(b => b.key);
      return v1BadgeKeys.every(key => ownedBadgeKeys.includes(key));
    },
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
    trigger: ({ participant }) =>
      participant.kills === 0 &&
      participant.deaths === 10 &&
      participant.assists === 0,
  },
  {
    key: "FARMING_SIMULATOR",
    name: "Farming Simulator",
    description: "Tuer plus de 300 sbires et perdre",
    rank: "Secret",
    repeatable: true,
    trigger: ({ participant }) =>
      participant.totalMinionsKilled + participant.neutralMinionsKilled > 300,
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
  {
    key: "JUNGLE_DIFF",
    name: "Jungle Diff",
    description:
      "Finir une partie de +30 min avec 0 Dragon et 0 Baron pour l'équipe",
    rank: "Secret",
    repeatable: true,
    trigger: ({ participant, teamStats, gameDuration }) =>
      participant.teamPosition === "JUNGLE" &&
      gameDuration > 1800 &&
      teamStats.baronKills === 0 &&
      teamStats.dragonKills === 0,
  },
  {
    key: "PACIFIST_SURE",
    name: "Pacifiste Sûr",
    description:
      "Avoir 0% de participation aux kills dans une partie de plus de 20 min",
    rank: "Secret",
    repeatable: true,
    trigger: ({ participant, gameDuration }) =>
      gameDuration > 1200 &&
      (participant.challenges?.killParticipation || 0) === 0,
  },
  {
    key: "COURTESY_INHIB",
    name: "L'Inhibiteur de Courtoisie",
    description:
      "Perdre la partie après avoir détruit un inhibiteur avant la 20ème minute",
    rank: "Secret",
    repeatable: true,
    trigger: ({ teamStats, gameDuration }) =>
      gameDuration < 1200 && teamStats.inhibitorKills > 0,
  },
  {
    key: "ARAM_SPEEDRUN",
    name: "Gardien du Nexus",
    description: "Perdre un ARAM en moins de 10 minutes",
    rank: "Secret",
    repeatable: true,
    trigger: ({ gameDuration, info }) =>
      info.gameMode === "ARAM" && gameDuration < 600,
  },
];

function evaluateTriggeredBadges(participant, streak, info, ownedBadgeKeys = []) {
  const teamId = participant.teamId;
  const ownTeamStats = info.teams.find((t) => t.teamId === teamId);
  const opponentTeamStats = info.teams.find((t) => t.teamId !== teamId);

  const opponents = info.participants.filter((p) => p.teamId !== teamId);
  const opponentDirect = opponents.find(
    (o) => o.teamPosition === participant.teamPosition,
  );
  const opponentTop = opponents.find((o) => o.teamPosition === "TOP");

  // On injecte aussi les participants adverses dans teamStats pour le badge Smite
  opponentTeamStats.participants = opponents;

  const context = {
    participant,
    streak,
    gameDuration: info.gameDuration,
    opponentDirect,
    opponentTop,
    teamStats: ownTeamStats,
    opponentTeamStats: opponentTeamStats,
    allParticipants: info.participants,
    info: info,
    ownedBadgeKeys: ownedBadgeKeys,
  };

  return BADGES.filter((badge) => badge.trigger(context));
}

module.exports = {
  BADGES,
  evaluateTriggeredBadges,
};
