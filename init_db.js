const Database = require("better-sqlite3");
const db = new Database("database.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    puuid TEXT PRIMARY KEY,
    game_name TEXT,
    tag_line TEXT,
    last_match_id TEXT,
    lp_solo_total INTEGER DEFAULT 0,
    lp_flex_total INTEGER DEFAULT 0,
    lp_tft_total INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    puuid TEXT,
    channel_id TEXT,
    PRIMARY KEY (puuid, channel_id)
  );
`);

console.log("✅ Base de données initialisée avec la colonne LP !");
