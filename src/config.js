require('dotenv').config();

function required(name, fallback) {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

module.exports = {
  port: parseInt(process.env.PORT || '8080', 10),
  apiKey: required('API_KEY'),
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPassword: required('ADMIN_PASSWORD'),

  panelDomain: process.env.PANEL_DOMAIN || 'localhost',
  vlessWsPath: process.env.VLESS_WS_PATH || '/xr-ws',
  xrayLocalPort: parseInt(process.env.XRAY_LOCAL_PORT || '10800', 10),
  xrayApiPort: parseInt(process.env.XRAY_API_PORT || '10085', 10),
  xrayBin: process.env.XRAY_BIN || '/usr/local/bin/xray',
  xrayConfigPath: process.env.XRAY_CONFIG_PATH || '/app/data/xray-config.json',
  statsIntervalMs: parseInt(process.env.STATS_INTERVAL_MS || '60000', 10),

  dbPath: process.env.DB_PATH || '/app/data/panel.db',
};
