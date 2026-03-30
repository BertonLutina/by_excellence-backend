
const path = require('path');
const {
  JWT_SECRET,
  IS_PROD,
  QUIET_LOGS,
  FRONTEND_ORIGIN,
  CORS_ORIGINS,
  IS_GANDI_HOSTING,
  PORT,
} = require('./constants/constant');

const parseCorsOrigins = (str) =>
  (str || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  const allowlist = new Set(
    [FRONTEND_ORIGIN, ...parseCorsOrigins(CORS_ORIGINS)].filter(Boolean)
  );
  if (!IS_GANDI_HOSTING && LOCAL_DEV_ORIGIN.test(origin)) {
    return callback(null, true);
  }
  if (allowlist.has(origin)) return callback(null, true);
  callback(null, false);
};

const startupLogPath = '/tmp/byex-backend-startup.log';
const trace = (msg) => {
  try {
    require('fs').appendFileSync(startupLogPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
};
trace('constants loaded');

process.stdout.on('error', (err) => {
  if (err.code !== 'EPIPE') throw err;
});



if (!JWT_SECRET || JWT_SECRET.trim() === '') {
  trace('JWT_SECRET missing from constants');
  console.error('[API] JWT_SECRET is required. Set it in your .env (e.g. JWT_SECRET=your_super_secret_jwt_key_here)');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
trace('server.js loaded');

const app = express();
app.set('trust proxy', 1);
const isProd = IS_PROD;
const quietLogs = QUIET_LOGS;

app.use(cors({ origin: corsOrigin, credentials: true }));

const stripeWebhookRoutes = require('./server/routes/stripeWebhook');
app.use('/api/stripe', stripeWebhookRoutes);

app.use(express.json());
trace('middleware ready');

const mountSafe = (mountPath, routeFile) => {
  try {
    trace(`mounting ${mountPath} from ${routeFile}`);
    const mod = require(routeFile);
    app.use(mountPath, mod);
    trace(`mounted ${mountPath}`);
  } catch (err) {
    trace(`mount FAILED ${mountPath}: ${err && err.stack ? err.stack : String(err)}`);
    throw err;
  }
};

mountSafe('/api/auth', './server/routes/auth');
mountSafe('/api/users', './server/routes/users');
mountSafe('/api/service-categories', './server/routes/serviceCategories');
mountSafe('/api/providers', './server/routes/providers');
mountSafe('/api/service-requests', './server/routes/serviceRequests');
const offerRespondRoutes = require('./server/routes/offerRespond');
app.use('/api/offers', offerRespondRoutes);
mountSafe('/api/offers', './server/routes/offers');
mountSafe('/api/payments', './server/routes/payments');
mountSafe('/api/reviews', './server/routes/reviews');
mountSafe('/api/messages', './server/routes/messages');
mountSafe('/api/service-items', './server/routes/serviceItems');
mountSafe('/api/provider-availabilities', './server/routes/providerAvailabilities');
mountSafe('/api/favorites', './server/routes/favorites');
mountSafe('/api/functions', './server/routes/functions');
mountSafe('/api/upload', './server/routes/upload');
mountSafe('/api/demandes', './server/routes/demandes');
mountSafe('/api/admin/demandes', './server/routes/adminDemandes');
mountSafe('/api/provider/demandes', './server/routes/providerDemandes');
mountSafe('/api/realtime', './server/routes/realtime');
mountSafe('/api/public', './server/routes/public');
trace('routes mounted');

const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');
app.use('/public', require('express').static(publicDir));
app.use('/uploads', require('express').static(uploadsDir));
trace(`public static: ${publicDir} (URLs /public/...); uploads alias: ${uploadsDir}`);

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

app.listen(PORT, '0.0.0.0', () => {
  trace(`listening on ${PORT}`);
  if (!quietLogs) console.log(`[API] By Excellence backend running on port ${PORT}`);
});
