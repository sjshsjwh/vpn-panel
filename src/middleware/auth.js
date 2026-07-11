const config = require('../config');

function apiKeyAuth(req, res, next) {
  const key = req.header('X-API-Key');
  if (!key || key !== config.apiKey) {
    return res.status(401).json({ error: 'invalid or missing X-API-Key header' });
  }
  next();
}

function basicAuth(req, res, next) {
  const header = req.header('authorization') || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    if (user === config.adminUser && pass === config.adminPassword) {
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="VPN Panel"');
  return res.status(401).send('Authentication required');
}

module.exports = { apiKeyAuth, basicAuth };
