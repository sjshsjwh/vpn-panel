const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid              TEXT UNIQUE NOT NULL,
    remark            TEXT NOT NULL,
    protocol          TEXT NOT NULL DEFAULT 'vless',
    flow              TEXT NOT NULL DEFAULT '',
    traffic_limit_gb  REAL NOT NULL DEFAULT 0,   -- 0 = unlimited
    traffic_used_bytes INTEGER NOT NULL DEFAULT 0,
    expire_at         INTEGER NOT NULL DEFAULT 0, -- unix seconds, 0 = never
    enabled           INTEGER NOT NULL DEFAULT 1,
    created_at        INTEGER NOT NULL,
    telegram_chat_id  TEXT
  );

  CREATE TABLE IF NOT EXISTS traffic_snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    uplink      INTEGER NOT NULL DEFAULT 0,
    downlink    INTEGER NOT NULL DEFAULT 0,
    recorded_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

module.exports = db;
