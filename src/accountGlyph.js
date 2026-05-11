/**
 * Glyphe décoratif stable par compte (dérivé du PUUID).
 * Même logique que `lib/accountGlyph.ts` côté front.
 */
const POOL = Array.from(
  "✷✺⚜♦❂✦⎈⚱☥♆✧◆❋⛧♫✒◎⊕◉⌘✚✶⊛✵✸⚔♜⛧◎",
);

function glyphForPuuid(puuid) {
  if (!puuid || typeof puuid !== "string") return "◆";
  let h = 0;
  for (let i = 0; i < puuid.length; i += 1) {
    h = (h * 31 + puuid.charCodeAt(i)) >>> 0;
  }
  return POOL[h % POOL.length] ?? "◆";
}

module.exports = { glyphForPuuid };
