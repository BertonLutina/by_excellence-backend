const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

let wss = null;

const init = (httpServer) => {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    ws.user = null;
    if (token) {
      try {
        ws.user = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        ws.user = null;
      }
    }

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('error', (err) => console.error('[WS] client error:', err.message));
    ws.on('close', () => {});
  });

  const heartbeat = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));
  console.log('[WS] WebSocket server initialised on /ws');
};

const broadcast = (payload, filter = null) => {
  if (!wss) return;
  const data = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState !== 1) return;
    if (filter && !filter(client)) return;
    client.send(data);
  });
};

const sendToUser = (email, payload) => {
  broadcast(payload, (client) => client.user?.email === email);
};

module.exports = { init, broadcast, sendToUser };
