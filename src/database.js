const Database = require("better-sqlite3");

const db = new Database("data/database.db");

function ensureSchema() {
  // --- NOUVELLE STRUCTURE CLAIRE V2 ---
  
  // Table des comptes LoL suivis
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      puuid TEXT PRIMARY KEY,
      game_name TEXT,
      tag_line TEXT,
      discord_user_id TEXT,
      total_losses INTEGER DEFAULT 0,
      max_loss_streak INTEGER DEFAULT 0,
      loss_streak INTEGER DEFAULT 0,
      total_time_spent_dead INTEGER DEFAULT 0,
      last_match_id TEXT,
      last_match_at INTEGER DEFAULT 0,
      last_checked_at INTEGER DEFAULT 0,
      last_tier TEXT
    );
  `);

  // Table de suivi par serveur (qui suit quel compte et où)
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_tracking (
      puuid TEXT,
      guild_id TEXT,
      channel_id TEXT,
      PRIMARY KEY (puuid, guild_id)
    );
  `);

  // Table des statistiques mensuelles
  db.exec(`
    CREATE TABLE IF NOT EXISTS monthly_stats (
      puuid TEXT,
      month TEXT,
      losses INTEGER DEFAULT 0,
      games INTEGER DEFAULT 0,
      total_time_spent_dead INTEGER DEFAULT 0,
      PRIMARY KEY (puuid, month)
    );
  `);

  // Table des badges débloqués (par compte LoL ou par utilisateur Discord)
  db.exec(`
    CREATE TABLE IF NOT EXISTS badges (
      entity_id TEXT NOT NULL,
      is_discord INTEGER NOT NULL DEFAULT 0,
      badge_key TEXT NOT NULL,
      first_unlocked_at TEXT NOT NULL,
      last_unlocked_at TEXT NOT NULL,
      unlock_count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (entity_id, badge_key)
    );
  `);

  // --- MIGRATIONS ET NETTOYAGE SÉCURISÉ ---
  
  // Migration de players -> accounts
  try {
    const playersTable = db.prepare("PRAGMA table_info(players)").all();
    if (playersTable.length > 0) {
      const cols = playersTable.map(c => c.name);
      
      // On construit dynamiquement la requête en fonction des colonnes présentes
      const selectFields = [
        "puuid",
        cols.includes("game_name") ? "game_name" : "NULL",
        cols.includes("tag_line") ? "tag_line" : "NULL",
        cols.includes("discord_user_id") ? "discord_user_id" : "NULL",
        cols.includes("total_losses") ? "total_losses" : "0",
        cols.includes("max_loss_streak") ? "max_loss_streak" : "0",
        cols.includes("loss_streak") ? "loss_streak" : "0",
        "0 as total_time_spent_dead",
        cols.includes("last_match_id") ? "last_match_id" : "NULL",
        "0 as last_match_at",
        "0 as last_checked_at",
        "NULL as last_tier"
      ].join(", ");

      const result = db.prepare(`
        INSERT OR IGNORE INTO accounts (
          puuid, game_name, tag_line, discord_user_id, 
          total_losses, max_loss_streak, loss_streak, 
          total_time_spent_dead, last_match_id, last_match_at, last_checked_at, last_tier
        ) 
        SELECT ${selectFields} FROM players
      `).run();

      console.log(`📊 Migration : ${result.changes} joueurs transférés de 'players' vers 'accounts'.`);
      db.exec("DROP TABLE players");
    }
  } catch (e) { console.error("❌ Erreur migration accounts:", e.message); }

  // Migration de subscriptions -> guild_tracking
  try {
    const subsTable = db.prepare("PRAGMA table_info(subscriptions)").all();
    if (subsTable.length > 0) {
      const cols = subsTable.map(c => c.name);
      if (cols.includes("guild_id")) {
        const result = db.prepare("INSERT OR IGNORE INTO guild_tracking (puuid, guild_id, channel_id) SELECT puuid, guild_id, channel_id FROM subscriptions").run();
        console.log(`📊 Migration : ${result.changes} suivis transférés vers 'guild_tracking'.`);
      } else {
        console.log("⚠️ Migration guild_tracking : 'guild_id' manquant dans l'ancienne table. Les liens serveur doivent être refaits via /add.");
      }
      db.exec("DROP TABLE subscriptions");
    }
  } catch (e) { console.error("❌ Erreur migration guild_tracking:", e.message); }

  // Migration de monthly_losses -> monthly_stats
  try {
    const monthlyTable = db.prepare("PRAGMA table_info(monthly_losses)").all();
    if (monthlyTable.length > 0) {
      const result = db.prepare("INSERT OR IGNORE INTO monthly_stats (puuid, month, losses) SELECT puuid, month, losses FROM monthly_losses").run();
      console.log(`📊 Migration : ${result.changes} stats mensuelles transférées.`);
      db.exec("DROP TABLE monthly_losses");
    }
  } catch (e) { console.error("❌ Erreur migration monthly_stats:", e.message); }

  // Migration de entity_badges -> badges
  try {
    const badgesTable = db.prepare("PRAGMA table_info(entity_badges)").all();
    if (badgesTable.length > 0) {
      const result = db.prepare("INSERT OR IGNORE INTO badges (entity_id, is_discord, badge_key, first_unlocked_at, last_unlocked_at, unlock_count) SELECT entity_id, is_discord, badge_key, first_unlocked_at, last_unlocked_at, unlock_count FROM entity_badges").run();
      console.log(`📊 Migration : ${result.changes} badges transférés.`);
      db.exec("DROP TABLE entity_badges");
    }
  } catch (e) { console.error("❌ Erreur migration badges:", e.message); }

  // Suppression de l'ancienne table obsolète player_badges
  try { db.exec("DROP TABLE IF EXISTS player_badges"); } catch (e) {}
}

module.exports = {
  db,
  ensureSchema,
};
