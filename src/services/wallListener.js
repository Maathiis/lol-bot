const { db } = require("../database");
const { getInsultResponse } = require("./insultResponder");

const WALL_INSULTS = [
  // connard et variantes
  "connard", "conard", "konard", "connart", "connar", "connare",
  "connasse", "conasse", "konasse",
  "con", "conne", "kon",
  // fdp / fils de pute
  "fdp", "fils de pute", "filsdepute", "fi1s de pute",
  // pd
  "pd", "p.d", "p d",
  // merde
  "merde", "merd", "mrde", "mrd",
  // enculé
  "encule", "enculer", "enkule", "encoulé", "encoule",
  // ta gueule
  "ta gueule", "ta geule", "ta guele", "tg",
  // nul / naze
  "nul", "nulle", "naze", "nas",
  "nul a chier", "nul à chier", "nula chier",
  // débile / idiot
  "debile", "débile", "debil", "idiot", "idiote", "idote", "idio",
  "cretin", "crétin", "createn",
  // pute / salope
  "pute", "put1", "salope", "salop", "salaud",
  // bâtard
  "batard", "batart", "bastard", "bastart",
  // chier
  "chier", "va chier", "fais chier", "fait chier", "fé chier",
  // inutile / de merde
  "inutile", "de merde", "demerde",
  // cringe
  "cringe", "cring",
  // abusé
  "abuse", "abusé", "abuser",
  // gros mots courts
  "ntm", "nique ta mere", "nique ta mère", "nqtm", "niquer",
  "va te faire", "vtff", "vtf",
  "imbecile", "imbécile", "imbesile",
  "raté", "rate", "looser", "loser",
  "boloss", "bolo", "bolos",
  "gros nul", "grosnul",
  "boulet", "boulets",
  "cancer", "cancre",
  "noob", "nub", "newb",
  // exploser
  "exploser", "explose", "explosé", "explosee", "xplose", "xploser",
  "il explose", "tu exploses", "fait exploser", "fais exploser",
  // ta mère
  "ta mere", "ta mère", "ta mer", "tamere", "ta.mere",
  "ta race", "ta rasse", "ta rase",
  "ta daronne", "ta dar",
  "fils de ta mere", "fils de ta mère",
  "va voir ta mere", "va voir ta mère",
  "ta famille", "votre mere", "votre mère",
  "sa mere", "sa mère", "samere",
];

function norm(s) {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function buildRegex(word) {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Utilise \b pour les mots simples, lookbehind/lookahead pour les phrases
  return new RegExp(`(?<![a-z])${esc}(?![a-z])`);
}

const INSULT_REGEXES = WALL_INSULTS.map((w) => buildRegex(norm(w)));

function containsBotInsult(text, mentionsBot = false) {
  const lower = norm(text);
  const targetsBot = mentionsBot || lower.includes("le bot");
  if (!targetsBot) return false;
  return INSULT_REGEXES.some((re) => re.test(lower));
}

function setupWallListener(client) {
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content || !message.content.trim()) return;
    const mentionsBot = message.mentions.users.has(message.client.user?.id ?? "");
    if (!containsBotInsult(message.content, mentionsBot)) return;

    const tracked = db
      .prepare("SELECT 1 FROM servers WHERE channel_id = ? LIMIT 1")
      .get(message.channelId);
    if (!tracked) return;

    const avatarUrl = message.author.avatar
      ? `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(message.author.id) % 5n)}.png`;

    try {
      db.prepare(
        `INSERT OR IGNORE INTO wall_messages (id, channel_id, author_id, author_name, author_avatar, content, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        message.id,
        message.channelId,
        message.author.id,
        message.member?.displayName || message.author.globalName || message.author.username,
        avatarUrl,
        message.content.trim(),
        message.createdTimestamp,
      );
    } catch (e) {
      console.error("wall_messages insert:", e.message);
    }

    // Réponse piquante avec stats réelles
    try {
      const reply = getInsultResponse(message.author.id, message.guildId);
      await message.reply(reply);
    } catch (e) {
      console.error("insult reply:", e.message);
    }
  });
}

module.exports = { setupWallListener, containsBotInsult };
