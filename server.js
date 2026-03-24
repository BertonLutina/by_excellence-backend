require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
  console.error('[API] JWT_SECRET is required. Set it in your .env (e.g. JWT_SECRET=your_super_secret_jwt_key_here)');
  process.exit(1);
}

const http = require('http');
const express = require('express');
const cors = require('cors');
const wsServer = require('./websocket/wsServer');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/service-categories', require('./routes/serviceCategories'));
app.use('/api/providers', require('./routes/providers'));
app.use('/api/service-requests', require('./routes/serviceRequests'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/service-items', require('./routes/serviceItems'));
app.use('/api/provider-availabilities', require('./routes/providerAvailabilities'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/functions', require('./routes/functions'));
app.use('/api/upload', require('./routes/upload'));

// Serve uploaded files (optional; in production use a CDN or static host)
const path = require('path');
const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
app.use('/uploads', require('express').static(uploadsDir));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

wsServer.init(server);

server.listen(PORT, () => {
  console.log(`[API] By Excellence backend running on http://localhost:${PORT}`);
});
