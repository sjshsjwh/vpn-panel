const express = require('express');
const usersModel = require('../models/users');
const manager = require('../xray/manager');
const { buildVlessLinkWithQr } = require('../xray/linkBuilder');

const router = express.Router();

function serializeUser(u) {
  const limitBytes = u.traffic_limit_gb > 0 ? u.traffic_limit_gb * 1024 * 1024 * 1024 : 0;
  return {
    id: u.id,
    uuid: u.uuid,
    remark: u.remark,
    protocol: u.protocol,
    flow: u.flow,
    enabled: !!u.enabled,
    createdAt: u.created_at,
    expireAt: u.expire_at || null,
    trafficLimitGb: u.traffic_limit_gb,
    trafficUsedBytes: u.traffic_used_bytes,
    trafficRemainingBytes: limitBytes > 0 ? Math.max(0, limitBytes - u.traffic_used_bytes) : null,
    telegramChatId: u.telegram_chat_id,
  };
}

router.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// List all users
router.get('/users', (req, res) => {
  res.json(usersModel.listUsers().map(serializeUser));
});

// Create a new user
router.post('/users', async (req, res) => {
  const { remark, protocol, flow, trafficLimitGb, expireAt, telegramChatId } = req.body || {};
  if (!remark || typeof remark !== 'string') {
    return res.status(400).json({ error: 'remark (string) is required' });
  }
  const user = usersModel.createUser({
    remark,
    protocol: protocol === 'vmess' ? 'vmess' : 'vless',
    flow: flow || '',
    trafficLimitGb: Number(trafficLimitGb) || 0,
    expireAt: Number(expireAt) || 0,
    telegramChatId: telegramChatId || null,
  });
  await manager.restart();
  const { link, qrDataUrl } = await buildVlessLinkWithQr(user);
  res.status(201).json({ ...serializeUser(user), link, qrDataUrl });
});

// Get one user
router.get('/users/:id', (req, res) => {
  const user = usersModel.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json(serializeUser(user));
});

// Get connection link + QR for a user
router.get('/users/:id/config', async (req, res) => {
  const user = usersModel.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  const { link, qrDataUrl } = await buildVlessLinkWithQr(user);
  res.json({ link, qrDataUrl });
});

// Update a user (remark, quota, expiry, enabled, flow)
router.patch('/users/:id', async (req, res) => {
  const fields = {};
  const body = req.body || {};
  if (body.remark !== undefined) fields.remark = body.remark;
  if (body.flow !== undefined) fields.flow = body.flow;
  if (body.trafficLimitGb !== undefined) fields.traffic_limit_gb = Number(body.trafficLimitGb) || 0;
  if (body.expireAt !== undefined) fields.expire_at = Number(body.expireAt) || 0;
  if (body.enabled !== undefined) fields.enabled = body.enabled ? 1 : 0;
  if (body.telegramChatId !== undefined) fields.telegram_chat_id = body.telegramChatId;

  const user = usersModel.updateUser(req.params.id, fields);
  if (!user) return res.status(404).json({ error: 'not found' });
  await manager.restart();
  res.json(serializeUser(user));
});

// Reset a user's traffic counter
router.post('/users/:id/reset', async (req, res) => {
  const user = usersModel.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  const updated = usersModel.resetTraffic(req.params.id);
  await manager.restart();
  res.json(serializeUser(updated));
});

// Enable / disable a user without deleting it
router.post('/users/:id/enable', async (req, res) => {
  const user = usersModel.setEnabled(req.params.id, true);
  if (!user) return res.status(404).json({ error: 'not found' });
  await manager.restart();
  res.json(serializeUser(user));
});

router.post('/users/:id/disable', async (req, res) => {
  const user = usersModel.setEnabled(req.params.id, false);
  if (!user) return res.status(404).json({ error: 'not found' });
  await manager.restart();
  res.json(serializeUser(user));
});

// Delete a user
router.delete('/users/:id', async (req, res) => {
  const user = usersModel.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  usersModel.deleteUser(req.params.id);
  await manager.restart();
  res.status(204).end();
});

module.exports = router;
