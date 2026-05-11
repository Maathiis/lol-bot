#!/usr/bin/env node
/**
 * Une commande pour :
 * 1) migrer / seed la BDD de test (data/database_2.db)
 * 2) pointer Lol_Bot_Dev/.env.local vers cette base + badges.js
 *
 * Usage (depuis la racine du repo lol-bot) :
 *   npm run prep:test
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dbFile = path.join(root, "data", "database_2.db");
const frontDir = path.join(root, "..", "Lol_Bot_Dev");
const frontEnv = path.join(frontDir, ".env.local");

process.chdir(root);
process.env.DATABASE_PATH = dbFile;
require("dotenv").config({ path: path.join(root, ".env") });
process.env.DATABASE_PATH = dbFile;

const dbModulePath = path.join(root, "src", "database.js");
delete require.cache[dbModulePath];
const { ensureSchema, db } = require(dbModulePath);

if (!fs.existsSync(path.join(root, "data"))) {
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
}

console.log("→ Schéma + seeds sur :\n  ", dbFile);
ensureSchema();
console.log("✅ Base `database_2.db` à jour.");

const { seedDemoData } = require(path.join(__dirname, "seed-demo-data.js"));
seedDemoData(db);
console.log("");

if (!fs.existsSync(frontDir)) {
  console.warn(
    "⚠️  Dossier Lol_Bot_Dev introuvable à côté de lol-bot :",
    frontDir,
    "\n   Crée toi-même .env.local avec DATABASE_PATH absolu vers database_2.db",
  );
  process.exit(0);
}

function upsertEnvLine(filePath, key, value) {
  let lines = [];
  if (fs.existsSync(filePath)) {
    lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  }
  const filtered = lines.filter((l) => l.trim() && !l.trim().startsWith(`${key}=`));
  filtered.push(`${key}=${value}`);
  fs.writeFileSync(filePath, filtered.join("\n") + "\n", "utf8");
}

const dbRel = path.relative(frontDir, dbFile).replace(/\\/g, "/");
const badgesRel = path.relative(frontDir, path.join(root, "badges.js")).replace(/\\/g, "/");

upsertEnvLine(frontEnv, "DATABASE_PATH", dbRel);
upsertEnvLine(frontEnv, "LOL_BOT_BADGES_PATH", badgesRel);

console.log("→ Front configuré :\n  ", frontEnv);
console.log("    DATABASE_PATH=" + dbRel);
console.log("    LOL_BOT_BADGES_PATH=" + badgesRel);
console.log("\n▶  Lance le front :\n    cd ../Lol_Bot_Dev && npm run dev\n");
