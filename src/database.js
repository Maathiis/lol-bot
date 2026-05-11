const Database = require("better-sqlite3");
const path = require("path");

const dbFile = process.env.DATABASE_PATH || "data/database.db";
const db = new Database(path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile));

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
      last_tier_solo TEXT,
      last_tier_flex TEXT,
      glyph TEXT
    );
  `);

  // Glyphe décoratif par compte LoL (affichage front / Discord)
  try {
    const accCols = db.prepare("PRAGMA table_info(accounts)").all();
    if (!accCols.find((c) => c.name === "glyph")) {
      db.exec("ALTER TABLE accounts ADD COLUMN glyph TEXT");
      console.log("✅ Migration : colonne accounts.glyph ajoutée.");
    }
    const { glyphForPuuid } = require("./accountGlyph");
    const needGlyph = db
      .prepare(
        `SELECT puuid FROM accounts WHERE glyph IS NULL OR TRIM(COALESCE(glyph, '')) = ''`,
      )
      .all();
    const upd = db.prepare("UPDATE accounts SET glyph = ? WHERE puuid = ?");
    for (const row of needGlyph) {
      upd.run(glyphForPuuid(row.puuid), row.puuid);
    }
    if (needGlyph.length > 0) {
      console.log(`✅ Comptes : ${needGlyph.length} glyphe(s) par défaut renseigné(s).`);
    }
  } catch (e) {
    console.error("❌ Migration accounts.glyph:", e.message);
  }

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

  // Catalogue des badges (métadonnées) — distinct des déblocages dans \`badges\`
  try {
    const { seedBadgeDefinitions } = require("./seedBadgeDefinitions");
    seedBadgeDefinitions(db);
  } catch (e) {
    console.error("❌ seed badge_definitions:", e.message);
  }

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
      let result;
      if (cols.includes("guild_id")) {
        result = db.prepare("INSERT OR IGNORE INTO guild_tracking (puuid, guild_id, channel_id) SELECT puuid, guild_id, channel_id FROM subscriptions").run();
      } else {
        // Utilisation du Guild ID fourni par l'utilisateur comme valeur par défaut pour la migration
        result = db.prepare("INSERT OR IGNORE INTO guild_tracking (puuid, guild_id, channel_id) SELECT puuid, '882374360269197342', channel_id FROM subscriptions").run();
        console.log("ℹ️ Migration guild_tracking : Utilisation du Guild ID par défaut '882374360269197342'.");
      }
      console.log(`📊 Migration : ${result.changes} suivis transférés vers 'guild_tracking'.`);
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

  // Migration pour séparer SoloQ et Flex
  try {
    let tableInfo = db.prepare("PRAGMA table_info(accounts)").all();
    if (!tableInfo.find((c) => c.name === "last_tier_solo")) {
      db.exec("ALTER TABLE accounts ADD COLUMN last_tier_solo TEXT");
      db.exec("ALTER TABLE accounts ADD COLUMN last_tier_flex TEXT");
      console.log("✅ Migration : Colonnes last_tier_solo et last_tier_flex ajoutées.");
    }
    tableInfo = db.prepare("PRAGMA table_info(accounts)").all();
    if (tableInfo.find((c) => c.name === "last_tier")) {
      // Ancienne BDD avec une seule colonne : on ne copie que vers Solo (file inconnue pour Flex).
      db.exec(`
        UPDATE accounts
        SET last_tier_solo = last_tier
        WHERE last_tier IS NOT NULL
          AND (last_tier_solo IS NULL OR TRIM(last_tier_solo) = '')
      `);
      db.exec("ALTER TABLE accounts DROP COLUMN last_tier");
      console.log(
        "✅ Migration : last_tier → last_tier_solo (Flex reste à jour par les parties Flex).",
      );
    }
  } catch (e) {
    console.error("❌ Erreur migration solo/flex:", e.message);
  }

  // Historique des parties (victoires + défaites ; le front n’affiche que les défaites)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS match_history (
        id TEXT NOT NULL,
        puuid TEXT NOT NULL,
        champion_name TEXT,
        kills INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        assists INTEGER DEFAULT 0,
        duration_seconds INTEGER DEFAULT 0,
        queue_id INTEGER,
        played_at TEXT NOT NULL,
        win INTEGER NOT NULL DEFAULT 0,
        badges_json TEXT,
        PRIMARY KEY (id, puuid)
      );
      CREATE INDEX IF NOT EXISTS idx_match_history_puuid_played
        ON match_history (puuid, played_at DESC);
    `);
  } catch (e) {
    console.error("❌ Migration match_history:", e.message);
  }
}

module.exports = {
  db,
  ensureSchema,
};
