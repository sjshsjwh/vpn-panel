const http = require('http');
const express = require('express');
const morgan = require('morgan');
const httpProxy = require('http-proxy');

const config = require('./config');
require('./db'); // ensures schema exists on boot

const { apiKeyAuth } = require('./middleware/auth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const xrayManager = require('./xray/manager');
const statsWorker = require('./xray/statsWorker');

const app = express();
app.use(morgan('tiny'));
app.use(express.json());

// Plain landing page so the bare domain doesn't look like a VPN panel.
app.get('/', (req, res) => {
  res.type('text/plain').send('OK');
});

app.use('/api', apiKeyAuth, apiRoutes);
app.use('/admin', adminRoutes);

const server = http.createServer(app);

// Reverse-proxy the VLESS WebSocket path straight through to the local
// Xray process. Everything else on this port is handled by Express above.
const wsProxy = httpProxy.createProxyServer({
  target: { host: '127.0.0.1', port: config.xrayLocalPort },
  ws: true,
});
wsProxy.on('error', (err, req, socket) => {
  console.error('[proxy] error:', err.message);
  if (socket && socket.destroy) socket.destroy();
});

server.on('upgrade', (req, socket, head) => {
  if (req.url && req.url.startsWith(config.vlessWsPath)) {
    wsProxy.ws(req, socket, head);
  } else {
    socket.destroy();
  }
});

async function main() {
  await xrayManager.restart(); // write config + spawn xray
  statsWorker.start();

  server.listen(config.port, () => {
    console.log(`Panel listening on :${config.port}`);
    console.log(`VLESS WS path: ${config.vlessWsPath}`);
  });
}

process.on('SIGTERM', () => {
  xrayManager.stop();
  process.exit(0);
});

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
