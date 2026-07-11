const { execFile } = require('child_process');
const config = require('../config');
const usersModel = require('../models/users');
const manager = require('./manager');

/**
 * Xray-core ships its own gRPC client as a CLI subcommand, so we shell out
 * to it instead of embedding a gRPC library. Stat names look like:
 *   user>>>user-<id>>>>traffic>>>uplink
 *   user>>>user-<id>>>>traffic>>>downlink
 *
 * NOTE: exact flags can vary slightly between Xray-core versions. If this
 * command errors out on your version, run `xray api statsquery --help`
 * inside the container and adjust the args below.
 */
function queryStats() {
  return new Promise((resolve) => {
    execFile(
      config.xrayBin,
      ['api', 'statsquery', `-s=127.0.0.1:${config.xrayApiPort}`, '-pattern=user>>>'],
      { timeout: 10000 },
      (err, stdout) => {
        if (err) {
          console.error('[stats] query failed:', err.message);
          return resolve([]);
        }
        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed.stat || []);
        } catch (e) {
          console.error('[stats] failed to parse xray output:', e.message);
          resolve([]);
        }
      }
    );
  });
}

async function tick() {
  const stats = await queryStats();
  if (stats.length > 0) {
    // name format: user>>>user-<id>>>>traffic>>>uplink|downlink
    const byUser = {};
    for (const s of stats) {
      const parts = s.name.split('>>>');
      const emailPart = parts[1]; // "user-<id>"
      const direction = parts[3]; // "uplink" | "downlink"
      const match = /^user-(\d+)$/.exec(emailPart || '');
      if (!match) continue;
      const userId = parseInt(match[1], 10);
      const value = parseInt(s.value, 10) || 0;
      byUser[userId] = byUser[userId] || 0;
      byUser[userId] += value;
      // Only positive deltas matter; Xray resets counters to 0 after each
      // "statsquery" call by default unless -reset=false is passed, so we
      // treat each value as a delta to add.
      if (value > 0) {
        usersModel.addTrafficBytes(userId, value);
      }
    }
  }

  // After updating usage, check whether anyone crossed their quota or
  // expiry since the last regeneration and needs to be dropped from config.
  const before = usersModel.listUsers().filter((u) => u.enabled).map((u) => u.id);
  const stillActive = usersModel.activeUsers().map((u) => u.id);
  const changed = before.length !== stillActive.length || before.some((id) => !stillActive.includes(id));
  if (changed) {
    console.log('[stats] active user set changed, regenerating xray config');
    manager.restart();
  }
}

function start() {
  tick(); // run once immediately
  setInterval(tick, config.statsIntervalMs);
}

module.exports = { start, queryStats };
