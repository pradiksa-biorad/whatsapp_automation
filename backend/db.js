const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    status TEXT DEFAULT 'disconnected',
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS configs (
    session_id TEXT PRIMARY KEY,
    group_jid TEXT,
    group_name TEXT,
    poll_question TEXT DEFAULT '🍽️ Will you be opting for office lunch today?',
    poll_options TEXT DEFAULT '["✅ Yes, I''ll have lunch","❌ No, I''ll skip today"]',
    cron_schedule TEXT DEFAULT '0 7 * * *',
    timezone TEXT DEFAULT 'Asia/Kolkata',
    enabled INTEGER DEFAULT 0,
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    sent_at INTEGER DEFAULT (strftime('%s','now')),
    group_name TEXT,
    poll_question TEXT,
    status TEXT,
    error TEXT,
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  );
`);

module.exports = {
  createSession(id) {
    db.prepare(`INSERT OR IGNORE INTO sessions (id) VALUES (?)`).run(id);
    db.prepare(`INSERT OR IGNORE INTO configs (session_id) VALUES (?)`).run(id);
  },

  getSession(id) {
    return db.prepare(`SELECT s.*, c.* FROM sessions s LEFT JOIN configs c ON s.id = c.session_id WHERE s.id = ?`).get(id);
  },

  updateSessionStatus(id, status, phone = null) {
    db.prepare(`UPDATE sessions SET status = ?, phone = COALESCE(?, phone) WHERE id = ?`).run(status, phone, id);
  },

  saveConfig(sessionId, config) {
    const { group_jid, group_name, poll_question, poll_options, cron_schedule, timezone, enabled } = config;
    db.prepare(`
      UPDATE configs SET
        group_jid = COALESCE(?, group_jid),
        group_name = COALESCE(?, group_name),
        poll_question = COALESCE(?, poll_question),
        poll_options = COALESCE(?, poll_options),
        cron_schedule = COALESCE(?, cron_schedule),
        timezone = COALESCE(?, timezone),
        enabled = COALESCE(?, enabled)
      WHERE session_id = ?
    `).run(
      group_jid || null,
      group_name || null,
      poll_question ?? null,
      poll_options ? JSON.stringify(poll_options) : null,
      cron_schedule ?? null,
      timezone ?? null,
      enabled !== undefined ? (enabled ? 1 : 0) : null,
      sessionId
    );
  },

  addHistory(sessionId, entry) {
    db.prepare(`
      INSERT INTO history (session_id, group_name, poll_question, status, error)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, entry.group_name, entry.poll_question, entry.status, entry.error ?? null);
  },

  getHistory(sessionId, limit = 20) {
    return db.prepare(`SELECT * FROM history WHERE session_id = ? ORDER BY sent_at DESC LIMIT ?`).all(sessionId, limit);
  },

  getAllSessions() {
    return db.prepare(`SELECT s.*, c.enabled, c.cron_schedule, c.timezone, c.group_name FROM sessions s LEFT JOIN configs c ON s.id = c.session_id`).all();
  },

  // Find an existing session by phone number (for returning users)
  getSessionByPhone(phone) {
    return db.prepare(`SELECT s.*, c.* FROM sessions s LEFT JOIN configs c ON s.id = c.session_id WHERE s.phone = ? ORDER BY s.created_at DESC LIMIT 1`).get(phone);
  },
};
