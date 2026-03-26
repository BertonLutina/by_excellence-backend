const router = require('express').Router();
const jwt = require('jsonwebtoken');
const sseBus = require('../realtime/sseBus');
const { JWT_SECRET } = require('../config/constant');

function resolveUser(req) {
  const header = req.headers.authorization;
  const headerToken = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  const queryToken = req.query?.token ? String(req.query.token) : null;
  const token = headerToken || queryToken;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

router.get('/sse', (req, res) => {
  const user = resolveUser(req);
  if (!user || !user.id) return res.status(401).json({ error: 'Unauthorized' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Initial event so client knows stream is active.
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ ok: true, user_id: user.id })}\n\n`);

  const unsubscribe = sseBus.subscribe(user.id, res);
  const keepAlive = setInterval(() => {
    res.write(`event: ping\n`);
    res.write(`data: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

module.exports = router;
