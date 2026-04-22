const fs = require("fs");
const Database = require("better-sqlite3");

// Assurer l'existence du dossier data
if (!fs.existsSync("data")) {
  fs.mkdirSync("data", { recursive: true });
}

const db = new Database("data/database.db");

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

// Migrations : ajouts de colonnes si elles n'existent pas encore
try {
  db.exec("ALTER TABLE players ADD COLUMN loss_streak INTEGER DEFAULT 0");
  console.log("✅ Colonne loss_streak ajoutée.");
} catch (e) {}

try {
  db.exec("ALTER TABLE players ADD COLUMN summoner_id TEXT");
  console.log("✅ Colonne summoner_id ajoutée.");
} catch (e) {}

try {
  db.exec("ALTER TABLE players ADD COLUMN discord_user_id TEXT");
  console.log("✅ Colonne discord_user_id ajoutée.");
} catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS player_badges (
    puuid TEXT NOT NULL,
    badge_key TEXT NOT NULL,
    first_unlocked_at TEXT NOT NULL,
    last_unlocked_at TEXT NOT NULL,
    unlock_count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (puuid, badge_key)
  );
`);

console.log("✅ Base de données initialisée !");
