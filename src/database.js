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
        time_spent_dead_seconds INTEGER DEFAULT 0,
        PRIMARY KEY (id, puuid)
      );
      CREATE INDEX IF NOT EXISTS idx_match_history_puuid_played
        ON match_history (puuid, played_at DESC);
    `);
  } catch (e) {
    console.error("❌ Migration match_history:", e.message);
  }

  try {
    const cols = db.prepare(`PRAGMA table_info(match_history)`).all();
    const have = new Set(cols.map((c) => c.name));
    if (!have.has("time_spent_dead_seconds")) {
      db.exec(`ALTER TABLE match_history ADD COLUMN time_spent_dead_seconds INTEGER DEFAULT 0`);
    }
    if (!have.has("team_position")) {
      db.exec(`ALTER TABLE match_history ADD COLUMN team_position TEXT`);
    }
  } catch (e) {
    console.error("❌ Migration match_history:", e.message);
  }

  // Journal des notifications Discord envoyées par le bot (page « Logs »).
  // Chaque ligne représente UN message poussé en notification (une perte, un
  // badge débloqué, un palier de série…). On ne dérive plus rien à la volée
  // côté front : tout ce qui est affiché vient de cette table.
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        kind TEXT NOT NULL,
        account_puuid TEXT,
        message TEXT NOT NULL,
        details_json TEXT,
        match_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_ts ON notifications (ts DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_puuid ON notifications (account_puuid);
    `);

    // Migration : colonne match_id (bases existantes)
    try {
      const notifCols = db.prepare("PRAGMA table_info(notifications)").all();
      if (!notifCols.find((c) => c.name === "match_id")) {
        db.exec("ALTER TABLE notifications ADD COLUMN match_id TEXT");
        console.log("✅ Migration : colonne notifications.match_id ajoutée.");
      }
    } catch (e) { console.error("❌ Migration notifications.match_id:", e.message); }

    // Backfill initial à partir de l’historique : on remplit la table une seule
    // fois (`notifications` vide ET `match_history` non vide) pour que la page
    // Logs ne soit pas blanche au premier lancement.
    const notifCount = db.prepare("SELECT COUNT(*) AS c FROM notifications").get();
    if (notifCount && notifCount.c === 0) {
      try {
        const histCount = db.prepare("SELECT COUNT(*) AS c FROM match_history").get();
        if (histCount && histCount.c > 0) {
          const QUEUE_LABEL = {
            420: "Ranked Solo",
            440: "Ranked Flex",
            450: "ARAM",
            400: "Draft Normale",
            490: "Quickplay",
            480: "Swiftplay",
            430: "Blind Pick",
          };
          const losses = db
            .prepare(
              `SELECT mh.id, mh.puuid, mh.champion_name, mh.kills, mh.deaths, mh.assists,
                      mh.duration_seconds, mh.queue_id, mh.played_at, mh.badges_json,
                      a.game_name, a.last_tier_solo
               FROM match_history mh
               JOIN accounts a ON a.puuid = mh.puuid
               WHERE mh.win = 0
               ORDER BY datetime(mh.played_at) ASC`,
            )
            .all();
          const insertNotif = db.prepare(
            `INSERT INTO notifications (ts, kind, account_puuid, message, details_json) VALUES (?,?,?,?,?)`,
          );
          const insertBadgeAt = db.prepare(
            `INSERT INTO notifications (ts, kind, account_puuid, message, details_json) VALUES (?, 'badge', ?, ?, ?)`,
          );
          const tx = db.transaction(() => {
            for (const r of losses) {
              const ts = Date.parse(r.played_at) || Date.now();
              const queueLabel = QUEUE_LABEL[r.queue_id] ?? "Partie";
              const mins = Math.floor(r.duration_seconds / 60);
              const secs = String(r.duration_seconds % 60).padStart(2, "0");
              const tier = r.last_tier_solo?.trim() || null;
              const tierStr = tier ? ` - ${tier}` : "";
              const name = r.game_name || "Invocateur";
              const message = `🚨 [${queueLabel}] - ${name} a perdu avec ${r.champion_name} (${r.kills}/${r.deaths}/${r.assists}) en ${mins}:${secs} min.${tierStr}`;
              insertNotif.run(
                ts,
                "loss",
                r.puuid,
                message,
                JSON.stringify({
                  queueLabel,
                  accountName: name,
                  champion: r.champion_name,
                  kills: r.kills,
                  deaths: r.deaths,
                  assists: r.assists,
                  durationSeconds: r.duration_seconds,
                  tier,
                }),
              );
              if (r.badges_json) {
                try {
                  const keys = JSON.parse(r.badges_json);
                  if (Array.isArray(keys)) {
                    for (const k of keys) {
                      const defRow = db
                        .prepare(`SELECT name FROM badge_definitions WHERE id = ?`)
                        .get(k);
                      const badgeName = defRow?.name ?? k;
                      insertBadgeAt.run(
                        ts,
                        r.puuid,
                        `✨ ${name} vient de débloquer le badge « ${badgeName} ».`,
                        JSON.stringify({ accountName: name, badgeKey: k, badgeName }),
                      );
                    }
                  }
                } catch {/* ignore */}
              }
            }
          });
          tx();
          console.log(`📝 notifications : backfill de ${losses.length} pertes (+ badges associés).`);
        }
      } catch (e) {
        console.error("❌ Backfill notifications:", e.message);
      }
    }
  } catch (e) {
    console.error("❌ Migration notifications:", e.message);
  }

  // Mur des messages — tous les messages postés dans les salons trackés
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS wall_messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_avatar TEXT,
        content TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_wall_messages_ts ON wall_messages (created_at_ms DESC);
    `);
  } catch (e) {
    console.error("❌ Migration wall_messages:", e.message);
  }

  // Parties en cours observées via Riot Spectator V5
  // - `live_games` : une ligne par partie active vue par le bot.
  // - `live_participants` : 10 lignes par partie. Le PUUID peut appartenir à un compte
  //   suivi (jointure `accounts`) ou à un adversaire inconnu (`is_server = 0`).
  // Une partie est considérée « live » tant que `observed_at_ms > NOW - 5 min`.
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS live_games (
        id TEXT PRIMARY KEY,
        queue_id INTEGER,
        game_mode TEXT,
        map_id INTEGER,
        started_at_ms INTEGER,
        observed_at_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_live_games_observed
        ON live_games (observed_at_ms DESC);

      CREATE TABLE IF NOT EXISTS live_participants (
        game_id TEXT NOT NULL,
        puuid TEXT NOT NULL,
        summoner_name TEXT,
        champion_id INTEGER,
        champion_name TEXT,
        team_id INTEGER NOT NULL,
        is_server INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (game_id, puuid)
      );
      CREATE INDEX IF NOT EXISTS idx_live_participants_puuid
        ON live_participants (puuid);
    `);
    try {
      const cols = db.prepare(`PRAGMA table_info(live_participants)`).all();
      const have = new Set(cols.map((c) => c.name));
      const add = (name, sqlType) => {
        if (!have.has(name)) {
          db.exec(`ALTER TABLE live_participants ADD COLUMN ${name} ${sqlType}`);
        }
      };
      add("spell1_id", "INTEGER");
      add("spell2_id", "INTEGER");
      add("kills", "INTEGER");
      add("deaths", "INTEGER");
      add("assists", "INTEGER");
      add("gold", "INTEGER");
      add("minions_killed", "INTEGER");
      add("champion_level", "INTEGER");
      add("riot_lane", "TEXT");
      add("perks_json", "TEXT");
    } catch (e2) {
      console.error("❌ Migration live_participants (colonnes live):", e2.message);
    }
  } catch (e) {
    console.error("❌ Migration live_games / live_participants:", e.message);
  }

  // Titres des joueurs — un titre est assigné à un compte (puuid)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS titles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        puuid TEXT NOT NULL,
        FOREIGN KEY (puuid) REFERENCES accounts(puuid) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_titles_puuid ON titles (puuid);
    `);

    // Seed "Beta testeur" pour tous les comptes qui ne l'ont pas encore
    const existing = db.prepare(
      `SELECT COUNT(*) AS c FROM titles WHERE title = 'Beta testeur'`
    ).get();
    if (existing && existing.c === 0) {
      const accounts = db.prepare("SELECT puuid FROM accounts").all();
      const insert = db.prepare("INSERT INTO titles (title, puuid) VALUES ('Beta testeur', ?)");
      const tx = db.transaction(() => {
        for (const row of accounts) insert.run(row.puuid);
      });
      tx();
      if (accounts.length > 0) {
        console.log(`✅ Titres : titre "Beta testeur" ajouté à ${accounts.length} compte(s).`);
      }
    }
  } catch (e) {
    console.error("❌ Migration titles:", e.message);
  }
}

module.exports = {
  db,
  ensureSchema,
};
