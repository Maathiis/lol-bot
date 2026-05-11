/**
 * Remplit `badge_definitions` à partir de `badges.js` (source de vérité métier).
 * Glyphes : même esthétique que l’ancien catalogue visuel (symboles variés).
 */
const path = require("path");

const GLYPH_POOL = Array.from(
  "✷✺🜂⚜♥⚒❂✦❋⚱☥♆✧◐◆❖⛧♫✒◎⊕◉⌘⌖✚✶⊛✵✸⚔♜⊕◈◐☽⚗ᛟ●♜⛧✒♫",
);

function seedBadgeDefinitions(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS badge_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      rank TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      repeatable INTEGER NOT NULL DEFAULT 1,
      queues_json TEXT,
      glyph TEXT NOT NULL DEFAULT '◆'
    );
  `);

  const countRow = db.prepare("SELECT COUNT(*) AS c FROM badge_definitions").get();
  if (countRow.c > 0) return false;

  const badgesPath = path.join(__dirname, "..", "badges.js");
  const { BADGES } = require(badgesPath);

  const insert = db.prepare(`
    INSERT INTO badge_definitions (id, name, description, rank, version, repeatable, queues_json, glyph)
    VALUES (@id, @name, @description, @rank, @version, @repeatable, @queues_json, @glyph)
  `);

  const run = db.transaction((list) => {
    list.forEach((b, i) => {
      const queuesJson =
        Array.isArray(b.allowed_queues) && b.allowed_queues.length > 0
          ? JSON.stringify(b.allowed_queues)
          : null;
      insert.run({
        id: b.key,
        name: b.name,
        description: b.description,
        rank: b.rank,
        version: b.version ?? 1,
        repeatable: b.repeatable ? 1 : 0,
        queues_json: queuesJson,
        glyph: GLYPH_POOL[i % GLYPH_POOL.length] ?? "◆",
      });
    });
  });

  run(BADGES);
  console.log(`✅ badge_definitions : ${BADGES.length} lignes insérées (glyphes + files d’obtention).`);
  return true;
}

module.exports = { seedBadgeDefinitions };
