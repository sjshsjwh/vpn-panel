const config = require('../config');
const { activeUsers } = require('../models/users');

/**
 * Build the full Xray-core config object.
 *
 * Single inbound: VLESS over WebSocket, no TLS (security: "none") because
 * the panel sits behind Railway's edge, which already terminates HTTPS/WSS
 * for the public domain and forwards plain traffic to this container.
 *
 * A local "api" inbound (dokodemo-door) exposes the StatsService/HandlerService
 * over gRPC on 127.0.0.1 only, used by statsWorker.js to read per-user traffic.
 */
function buildXrayConfig() {
  const clients = activeUsers().map((u) => {
    const client = { id: u.uuid, email: `user-${u.id}` };
    if (u.protocol === 'vless' && u.flow) client.flow = u.flow;
    return client;
  });

  return {
    log: { loglevel: 'warning' },

    api: {
      tag: 'api',
      services: ['HandlerService', 'StatsService'],
    },

    stats: {},

    policy: {
      levels: {
        0: {
          statsUserUplink: true,
          statsUserDownlink: true,
        },
      },
      system: {
        statsInboundUplink: false,
        statsInboundDownlink: false,
      },
    },

    inbounds: [
      {
        listen: '127.0.0.1',
        port: config.xrayApiPort,
        protocol: 'dokodemo-door',
        settings: { address: '127.0.0.1' },
        tag: 'api-in',
      },
      {
        listen: '127.0.0.1',
        port: config.xrayLocalPort,
        protocol: 'vless',
        settings: {
          clients,
          decryption: 'none',
        },
        streamSettings: {
          network: 'ws',
          security: 'none',
          wsSettings: {
            path: config.vlessWsPath,
          },
        },
        sniffing: {
          enabled: true,
          destOverride: ['http', 'tls'],
        },
        tag: 'vless-ws-in',
      },
    ],

    outbounds: [
      { protocol: 'freedom', tag: 'direct' },
      { protocol: 'blackhole', tag: 'blocked' },
    ],

    routing: {
      rules: [
        { type: 'field', inboundTag: ['api-in'], outboundTag: 'api' },
      ],
    },
  };
}

module.exports = { buildXrayConfig };
