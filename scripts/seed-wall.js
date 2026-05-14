/**
 * Seed ~50 messages de test dans wall_messages.
 * Usage : node scripts/seed-wall.js
 * Supprimer ensuite : node scripts/seed-wall.js --clean
 */
require("dotenv").config();
const { db, ensureSchema } = require("../src/database");
ensureSchema();

const CLEAN = process.argv.includes("--clean");

if (CLEAN) {
  const r = db.prepare("DELETE FROM wall_messages WHERE author_id LIKE 'seed_%'").run();
  console.log(`🗑️  ${r.changes} messages de seed supprimés.`);
  process.exit(0);
}

const CHANNEL_ID = db.prepare("SELECT DISTINCT channel_id FROM guild_tracking LIMIT 1").get()?.channel_id ?? "000";

// Joueurs fictifs pour les seeds (basés sur les vrais pseudos Discord)
const PLAYERS = [
  { id: "seed_zoorva",   name: "Zoorva",         avatar: null },
  { id: "seed_valou",    name: "TheValou",        avatar: null },
  { id: "seed_inco",     name: "IncoNitro",       avatar: null },
  { id: "seed_kali",     name: "Kali Got a Job",  avatar: null },
  { id: "seed_sayzy",    name: "Sayzy",           avatar: null },
  { id: "seed_lodju",    name: "Lodju",           avatar: null },
  { id: "seed_tasty",    name: "TastyCrousty",    avatar: null },
  { id: "seed_du",       name: "Du RS3 au RSA",   avatar: null },
];

// Messages de longueurs variées — tous contiennent "le bot" + une insulte
const MESSAGES = [
  // Courts
  "le bot de fdp encore ça",
  "le bot nul",
  "le bot de merde",
  "nique le bot",
  "va chier le bot",
  "le bot connard",
  "le bot ta mère",
  "le bot noob",
  "sale bot de merde",
  "le bot je te déteste",

  // Moyens
  "sérieusement le bot il est trop nul à chier, il a encore raté ma défaite",
  "le bot de merde il a pas annoncé ma game, j'ai perdu 3 fois de suite et rien",
  "le bot connard il annonce jamais quand ça arrange pas",
  "le bot ta mère il rate toujours les games importantes",
  "ouais le bot il est inutile ce soir, 0 annonce depuis 2h",
  "le bot il explose tout ce soir encore, 4 défaites pas signalées",
  "le bot fdp tu sers à rien depuis ce matin",
  "mais le bot de merde il est en train de partir en vrille ou quoi ?",
  "le bot nul à chier il a encore perdu le fil de mes stats",
  "franchement le bot il me saoule, toujours en retard sur les annonces",

  // Longs
  "le bot de merde il a encore raté la game de Zoorva ce soir. 0/12 en ranked et RIEN. Le bot il dormait ou quoi ? On paye pas pour avoir un bot inutile qui rate les défaites les plus épiques du serveur franchement",
  "non mais sérieusement le bot connard, TheValou vient de faire la pire game de sa vie — 2/15 en 28 minutes sur Yasuo en soloQ — et le bot il dit pas un mot. C'est quoi cette blague",
  "je comprends pas le bot de fdp, il annonce les games normales mais quand IncoNitro fait 0/8 avant 15 minutes c'est silence radio. C'est exactement dans ces moments qu'on a besoin de toi sale bot",
  "le bot ta mère il a encore planté cette nuit. 3 défaites de Sayzy pas enregistrées, son streak aurait dû passer à 7 et là il est toujours à 4. C'est du grand n'importe quoi",
  "franchement le bot inutile, depuis la mise à jour il annonce même plus les défaites en ARAM. Lodju a perdu 5 fois d'affilée en ARAM cette semaine et zéro notification. Sérieusement c'est quoi le but",
  "le bot noob il a dormi pendant toute la session de ranked de Kali ce soir. 4 défaites de suite, un streak à 6, et monsieur le bot il était occupé à rien faire. Inutile",
  "mais le bot de merde il fait quoi exactement ? TastyCrousty vient de perdre sa 10ème ranked du mois et le bot il a même pas eu la décence d'annoncer. On dirait qu'il fait exprès de rater les gros moments",
  "non mais le bot fdp il a encore eu un bug cette nuit. Toutes les games de Du RS3 au RSA entre 2h et 4h du mat sont perdues et rien dans le salon. Je sais pas si c'est l'API Riot ou le bot mais en tout cas c'est nul",

  // Très longs / multi-lignes
  "RAPPORT DE DYSFONCTIONNEMENT — LE BOT DE MERDE\n\nCe soir entre 21h et 23h le bot a raté pas moins de 6 défaites :\n- Zoorva : 0/9 sur Azir (pas annoncé)\n- IncoNitro : 2/14 sur Teemo (pas annoncé)\n- TheValou : défaite en 18 min (pas annoncé)\n\nLe bot ta mère il fait son travail ou pas ?",
  "le bot de fdp j'ai un tweet à faire sur ce que t'as fait ce soir\n\n'Dear le bot, merci d'avoir raté les 4 défaites consécutives de Sayzy ce vendredi soir. Grâce à toi, personne a pu se moquer de lui en temps réel. T'es vraiment inutile.'\n\nVoilà c'est dit",
  "récapitulatif du weekend :\n- vendredi soir : le bot de merde rate 3 games\n- samedi matin : le bot repart en vrille, 2 games ratées\n- samedi soir : là le bot connard décide de planter complètement\n- dimanche : le bot fonctionne mais pour annoncer que des victoires obviously\n\nBilan : le bot est nul",
  "le bot inutile je vais te faire une liste de toutes les fois où t'as merdé ce mois-ci :\n1. Le 3 mai - game de Lodju pas annoncée\n2. Le 7 mai - streak de Kali raté\n3. Le 11 mai - toute la session ARAM ignorée\n4. Le 14 mai - encore raté la game de TastyCrousty\n\nLe bot de merde franchement",
  "le bot ta mère mais genre il est vraiment inutile ce truc. Zoorva perd 8 games en 2 jours, son streak monte à 8 et le bot il annonce rien. Du RS3 au RSA fait 1/17 sur Vayne et rien. IncoNitro tilt complètement et le bot dort. C'est quoi ce service",

  // Réactions en temps réel
  "LE BOT DE MERDE IL A ENCORE RATÉ LA GAME",
  "non mais le bot fdp là j'hallucine",
  "le bot ta gueule tu sers à rien",
  "le bot noob il rate encore les games en ranked c'est incroyable",
  "le bot connard il pouvait pas annoncer CELLE LÀ ?",
  "le bot inutile je te jure je vais te débrancher",
  "le bot de merde il aime pas Zoorva ou quoi",
  "le bot encule il a même pas vu la game",
  "nan le bot fdp c'est trop fort comme timing",
  "le bot ta mère il rate jamais les victoires par contre",
  "le bot naze il fait quoi là sérieusement",
  "le bot de merde Sayzy vient de faire 2/13 et toi tu dors",
];

// Timestamps sur les 6 derniers mois, aléatoires
function randTs() {
  const now = Date.now();
  const sixMonths = 6 * 30 * 24 * 60 * 60 * 1000;
  return now - Math.floor(Math.random() * sixMonths);
}

const stmt = db.prepare(
  `INSERT OR IGNORE INTO wall_messages (id, channel_id, author_id, author_name, author_avatar, content, created_at_ms)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

let added = 0;
const tx = db.transaction(() => {
  for (let i = 0; i < MESSAGES.length; i++) {
    const player = PLAYERS[i % PLAYERS.length];
    const id = `seed_${i}_${Date.now() + i}`;
    stmt.run(id, CHANNEL_ID, player.id, player.name, null, MESSAGES[i], randTs());
    added++;
  }
});
tx();

console.log(`✅ ${added} messages de seed insérés (channel ${CHANNEL_ID}).`);
console.log(`   Pour nettoyer : node scripts/seed-wall.js --clean`);
