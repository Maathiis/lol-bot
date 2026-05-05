const Database = require("better-sqlite3");

const db = new Database("data/database.db");

function ensureSchema() {
  try {
    db.exec("ALTER TABLE players ADD COLUMN discord_user_id TEXT");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE players ADD COLUMN total_losses INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE players ADD COLUMN max_loss_streak INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE monthly_losses ADD COLUMN games INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE players ADD COLUMN last_match_at INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE players ADD COLUMN last_checked_at INTEGER DEFAULT 0");
  } catch (e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS monthly_losses (
      puuid TEXT,
      month TEXT,
      losses INTEGER DEFAULT 0,
      games INTEGER DEFAULT 0,
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
}

module.exports = {
  db,
  ensureSchema,
};
