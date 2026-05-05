const { db } = require("../database");

async function announceMonthlyStats(client) {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const prevMonthStr = now.toISOString().slice(0, 7);

  const rows = db.prepare(`
    SELECT 
      COALESCE(p.discord_user_id, p.game_name || '#' || p.tag_line) as identifier,
      MAX(p.discord_user_id) as is_discord,
      SUM(ml.losses) as total_month
    FROM monthly_losses ml
    JOIN players p ON p.puuid = ml.puuid
    WHERE ml.month = ?
    GROUP BY identifier
    ORDER BY total_month DESC
  `).all(prevMonthStr);

  if (!rows.length) return;

  let msg = `📢 **BILAN MENSUEL DES DÉFAITES (${prevMonthStr})** 📢\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let label = `**${r.identifier}**`;
    if (r.is_discord) {
      try {
        const user = client.users.cache.get(r.identifier) || await client.users.fetch(r.identifier);
        label = `**${user.globalName || user.username}**`;
      } catch { }
    }
    msg += `${i + 1}. ${label} : **${r.total_month}** défaites\n`;
  }
  msg += "━━━━━━━━━━━━━━━━━━━━━━━━";

  const channels = db.prepare("SELECT DISTINCT channel_id FROM subscriptions").all();
  for (const c of channels) {
    const chan = await client.channels.fetch(c.channel_id).catch(() => null);
    if (chan) await chan.send(msg);
  }
}

module.exports = { announceMonthlyStats };
