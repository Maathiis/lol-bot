const fs = require("fs");
const { ensureSchema } = require("./src/database");

// Charger l'environnement
const envPath = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
require("dotenv").config({ path: envPath });

// Assurer l'existence du dossier data
if (!fs.existsSync("data")) {
  fs.mkdirSync("data", { recursive: true });
}

// Initialiser le schéma (V2)
ensureSchema();

console.log("✅ Base de données initialisée !");
