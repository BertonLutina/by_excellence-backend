require('dotenv').config();
const fs = require('fs');
const path = require('path');

const startupLogPath = '/tmp/byex-backend-startup.log';
const trace = (msg) => {
  try {
    fs.appendFileSync(startupLogPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
};

process.stdout.on('error', (err) => {
  if (err.code !== 'EPIPE') throw err;
});

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
  console.error('[API] JWT_SECRET is required. Set it in your .env (e.g. JWT_SECRET=your_super_secret_jwt_key_here)');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
trace('server.js loaded');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const quietLogs = isProd && (process.env.LOG_LEVEL || 'error') === 'error';

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
trace('middleware ready');

app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/users', require('./server/routes/users'));
app.use('/api/service-categories', require('./server/routes/serviceCategories'));
app.use('/api/providers', require('./server/routes/providers'));
app.use('/api/service-requests', require('./server/routes/serviceRequests'));
app.use('/api/offers', require('./server/routes/offers'));
app.use('/api/payments', require('./server/routes/payments'));
app.use('/api/reviews', require('./server/routes/reviews'));
app.use('/api/messages', require('./server/routes/messages'));
app.use('/api/service-items', require('./server/routes/serviceItems'));
app.use('/api/provider-availabilities', require('./server/routes/providerAvailabilities'));
app.use('/api/favorites', require('./server/routes/favorites'));
app.use('/api/functions', require('./server/routes/functions'));
app.use('/api/upload', require('./server/routes/upload'));
app.use('/api/demandes', require('./server/routes/demandes'));
app.use('/api/admin/demandes', require('./server/routes/adminDemandes'));
app.use('/api/provider/demandes', require('./server/routes/providerDemandes'));
app.use('/api/realtime', require('./server/routes/realtime'));
trace('routes mounted');

const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
app.use('/uploads', require('express').static(uploadsDir));
trace(`uploads dir: ${uploadsDir}`);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use(express.static(path.join(__dirname, 'build')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  trace(`express error: ${err.message || 'unknown'}`);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  trace(`unhandledRejection: ${reason && reason.stack ? reason.stack : String(reason)}`);
});
process.on('uncaughtException', (err) => {
  trace(`uncaughtException: ${err && err.stack ? err.stack : String(err)}`);
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, '0.0.0.0', () => {
  trace(`listening on ${PORT}`);
  if (!quietLogs) console.log(`[API] By Excellence backend running on port ${PORT}`);
});
