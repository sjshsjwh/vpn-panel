const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config');
const { buildXrayConfig } = require('./configTemplate');

let xrayProcess = null;
let restarting = false;
let pendingRestart = false;

function writeConfig() {
  const cfg = buildXrayConfig();
  fs.mkdirSync(path.dirname(config.xrayConfigPath), { recursive: true });
  fs.writeFileSync(config.xrayConfigPath, JSON.stringify(cfg, null, 2));
}

function startProcess() {
  xrayProcess = spawn(config.xrayBin, ['run', '-config', config.xrayConfigPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  xrayProcess.stdout.on('data', (d) => process.stdout.write(`[xray] ${d}`));
  xrayProcess.stderr.on('data', (d) => process.stderr.write(`[xray] ${d}`));

  xrayProcess.on('exit', (codeVal, signal) => {
    console.log(`[xray] process exited (code=${codeVal}, signal=${signal})`);
    xrayProcess = null;
    // Unexpected exit while the panel is still running -> bring it back up.
    if (!restarting) {
      setTimeout(() => restart(), 2000);
    }
  });
}

/**
 * Rewrite the config file and (re)start Xray so the running process reflects
 * the current set of active users. Debounced so a burst of API calls only
 * triggers one restart.
 */
async function restart() {
  if (restarting) {
    pendingRestart = true;
    return;
  }
  restarting = true;
  try {
    writeConfig();
    if (xrayProcess) {
      await new Promise((resolve) => {
        xrayProcess.once('exit', resolve);
        xrayProcess.kill('SIGTERM');
        setTimeout(resolve, 3000); // safety net if it won't die
      });
    }
    startProcess();
  } finally {
    restarting = false;
    if (pendingRestart) {
      pendingRestart = false;
      restart();
    }
  }
}

function stop() {
  restarting = true; // prevent auto-respawn
  if (xrayProcess) xrayProcess.kill('SIGTERM');
}

module.exports = { restart, stop, writeConfig };
