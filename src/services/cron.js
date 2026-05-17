const { db } = require("../database");

const SKIP_DISCORD_SEND =
  process.env.SKIP_DISCORD_NOTIFICATIONS === "1" ||
  process.env.SKIP_DISCORD_NOTIFICATIONS === "true";

async function announceMonthlyStats(client) {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const prevMonthStr = now.toISOString().slice(0, 7);

  const rows = db.prepare(`
    SELECT 
      COALESCE(p.discord_user_id, p.game_name || '#' || p.tag_line) as identifier,
      MAX(p.discord_user_id) as is_discord,
      SUM(ms.losses) as total_month
    FROM monthly_stats ms
    JOIN accounts p ON p.puuid = ms.puuid
    WHERE ms.month = ?
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

  const channels = db.prepare("SELECT channel_id FROM servers").all();
  for (const c of channels) {
    const chan = await client.channels.fetch(c.channel_id).catch(() => null);
    if (!chan) continue;
    if (SKIP_DISCORD_SEND) {
      console.log("[SKIP_DISCORD_NOTIFICATIONS] Bilan mensuel non envoyé.");
      break;
    }
    await chan.send(msg);
  }
}

module.exports = { announceMonthlyStats };
