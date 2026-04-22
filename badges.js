const BADGES = [
  {
    key: "5L",
    name: "5L",
    description: "Petite série de défaites",
    repeatable: false,
    trigger: ({ streak }) => streak === 5,
  },
  {
    key: "10L",
    name: "10L",
    description: "Grosse série de défaites",
    repeatable: false,
    trigger: ({ streak }) => streak === 10,
  },
  {
    key: "POWERSPIKE_YASUO",
    name: "Powerspike Yasuo",
    description: "Un match en 0/10/0, l'art du timing",
    repeatable: true,
    trigger: ({ participant }) =>
      participant.kills === 0 &&
      participant.deaths >= 10 &&
      participant.assists === 0,
  },
  {
    key: "TEST_LOSS",
    name: "Mauvais perdant",
    description: "A perdu une partie (badge de test)",
    repeatable: true,
    trigger: ({ participant }) => !participant.win,
  },
  {
    key: "NEGATIVE_KDA",
    name: "Boulet",
    description: "A finit en négatif (plus de morts que de kills)",
    repeatable: true,
    trigger: ({ participant }) => participant.kills < participant.deaths,
  },
];

function evaluateTriggeredBadges(participant, streak) {
  return BADGES.filter((badge) => badge.trigger({ participant, streak }));
}

module.exports = {
  BADGES,
  evaluateTriggeredBadges,
};
