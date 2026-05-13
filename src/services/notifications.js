const { db } = require("../database");

/**
 * Enregistre dans la table `notifications` ce qui vient d’être envoyé sur
 * Discord. La page « Logs » du front lit directement cette table — aucune
 * autre source de vérité n’est utilisée côté affichage.
 *
 * @param {{
 *   ts?: number,
 *   kind: 'loss' | 'win' | 'badge' | 'streak',
 *   accountPuuid?: string | null,
 *   message: string,
 *   details?: Record<string, unknown> | null,
 * }} params
 */
function recordNotification({ ts, kind, accountPuuid = null, message, details = null }) {
  try {
    db.prepare(
      `INSERT INTO notifications (ts, kind, account_puuid, message, details_json)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      ts ?? Date.now(),
      kind,
      accountPuuid,
      message,
      details ? JSON.stringify(details) : null,
    );
  } catch (e) {
    console.error(`notifications insert (${kind}):`, e.message);
  }
}

module.exports = { recordNotification };
