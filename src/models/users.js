const { v4: uuidv4 } = require('uuid');
const db = require('../db');

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function listUsers() {
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
}

function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserByUuid(uuid) {
  return db.prepare('SELECT * FROM users WHERE uuid = ?').get(uuid);
}

function createUser({ remark, protocol = 'vless', flow = '', trafficLimitGb = 0, expireAt = 0, telegramChatId = null }) {
  const uuid = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO users (uuid, remark, protocol, flow, traffic_limit_gb, expire_at, enabled, created_at, telegram_chat_id)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  const info = stmt.run(uuid, remark, protocol, flow, trafficLimitGb, expireAt, nowSeconds(), telegramChatId);
  return getUser(info.lastInsertRowid);
}

function updateUser(id, fields) {
  const existing = getUser(id);
  if (!existing) return null;

  const allowed = ['remark', 'flow', 'traffic_limit_gb', 'expire_at', 'enabled', 'telegram_chat_id'];
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }
  if (sets.length === 0) return existing;

  values.push(id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getUser(id);
}

function deleteUser(id) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

function resetTraffic(id) {
  db.prepare('UPDATE users SET traffic_used_bytes = 0 WHERE id = ?').run(id);
  return getUser(id);
}

function addTrafficBytes(id, bytes) {
  db.prepare('UPDATE users SET traffic_used_bytes = traffic_used_bytes + ? WHERE id = ?').run(bytes, id);
}

function setEnabled(id, enabled) {
  db.prepare('UPDATE users SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  return getUser(id);
}

// Users that should currently be active in the Xray config:
// enabled, not expired, and under their traffic quota (0 = unlimited).
function activeUsers() {
  const now = nowSeconds();
  return listUsers().filter((u) => {
    if (!u.enabled) return false;
    if (u.expire_at && u.expire_at < now) return false;
    if (u.traffic_limit_gb > 0) {
      const limitBytes = u.traffic_limit_gb * 1024 * 1024 * 1024;
      if (u.traffic_used_bytes >= limitBytes) return false;
    }
    return true;
  });
}

module.exports = {
  listUsers,
  getUser,
  getUserByUuid,
  createUser,
  updateUser,
  deleteUser,
  resetTraffic,
  addTrafficBytes,
  setEnabled,
  activeUsers,
};
