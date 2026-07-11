const QRCode = require('qrcode');
const config = require('../config');

function buildVlessLink(user) {
  const params = new URLSearchParams({
    type: 'ws',
    security: 'tls',
    path: config.vlessWsPath,
    host: config.panelDomain,
    sni: config.panelDomain,
  });
  if (user.flow) params.set('flow', user.flow);

  const remark = encodeURIComponent(user.remark || `user-${user.id}`);
  return `vless://${user.uuid}@${config.panelDomain}:443?${params.toString()}#${remark}`;
}

async function buildVlessLinkWithQr(user) {
  const link = buildVlessLink(user);
  const qrDataUrl = await QRCode.toDataURL(link);
  return { link, qrDataUrl };
}

module.exports = { buildVlessLink, buildVlessLinkWithQr };
