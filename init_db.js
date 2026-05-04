const fs = require("fs");
const Database = require("better-sqlite3");

// Charger l'environnement
const envPath = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
require("dotenv").config({ path: envPath });

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
} catch (e) {}

try {
  db.exec("ALTER TABLE players ADD COLUMN summoner_id TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE players ADD COLUMN discord_user_id TEXT");
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

  CREATE TABLE IF NOT EXISTS monthly_losses (
    puuid TEXT,
    month TEXT,
    losses INTEGER DEFAULT 0,
    PRIMARY KEY (puuid, month)
  );

  CREATE TABLE IF NOT EXISTS entity_badges (
    entity_id TEXT NOT NULL,
    is_discord INTEGER NOT NULL DEFAULT 0,
    badge_key TEXT NOT NULL,
    first_unlocked_at TEXT NOT NULL,
    last_unlocked_at TEXT NOT NULL,
    unlock_count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (entity_id, badge_key)
  );
`);

// Migration from player_badges to entity_badges
try {
  db.exec(`
    INSERT OR IGNORE INTO entity_badges (entity_id, is_discord, badge_key, first_unlocked_at, last_unlocked_at, unlock_count)
    SELECT puuid, 0, badge_key, first_unlocked_at, last_unlocked_at, unlock_count FROM player_badges;
  `);
} catch (e) {}

try {
  db.exec("ALTER TABLE players ADD COLUMN total_losses INTEGER DEFAULT 0");
} catch (e) {}

try {
  db.exec("ALTER TABLE players ADD COLUMN max_loss_streak INTEGER DEFAULT 0");
} catch (e) {}

console.log("✅ Base de données initialisée !");
