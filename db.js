const Database = require("better-sqlite3");

const db = new Database("reminders.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    due_time INTEGER NOT NULL,  -- UNIX timestamp
    sent INTEGER DEFAULT 0     -- 0: не отправлено, 1: отправлено
  )
`);

module.exports = db;
