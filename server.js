
const path = require('path');
const {
  JWT_SECRET,
  IS_PROD,
  QUIET_LOGS,
  FRONTEND_ORIGIN,
  CORS_ORIGINS,
  ALLOW_LOCAL_DEV_CORS,
  PORT,
} = require('./constants/constant');
const { createCorsOriginChecker } = require('./server/utils/corsPolicy');

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


const { validateJwtSecret, MIN_PRODUCTION_JWT_SECRET_LENGTH } = require('./server/utils/secretPolicy');
const jwtSecretValidation = validateJwtSecret(JWT_SECRET, { isProd: IS_PROD });
if (!jwtSecretValidation.ok) {
  trace(`JWT_SECRET invalid: ${jwtSecretValidation.reason}`);
  const hint = jwtSecretValidation.reason === 'too_short'
    ? `JWT_SECRET must be at least ${MIN_PRODUCTION_JWT_SECRET_LENGTH} characters in production.`
    : 'JWT_SECRET is required.';
  console.error(`[API] ${hint} Set it in your Gandi environment variables.`);
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
trace('server.js loaded');

const app = express();
app.set('trust proxy', 1);
const isProd = IS_PROD;
const quietLogs = QUIET_LOGS;
const corsOrigin = createCorsOriginChecker({
  frontendOrigin: FRONTEND_ORIGIN,
  corsOrigins: CORS_ORIGINS,
  isProd,
  allowLocalDevCors: ALLOW_LOCAL_DEV_CORS,
});

app.use(
  helmet({
    // API + static uploads consumed by another origin (the Vite frontend):
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors({ origin: corsOrigin, credentials: true }));

const stripeWebhookRoutes = require('./server/routes/stripeWebhook');
app.use('/api/stripe', stripeWebhookRoutes);

// Stripe CLI: `stripe listen --forward-to http://localhost:8080/webhook`
// (same handler as POST /api/stripe/webhook; use the whsec_ printed by `stripe listen` in STRIPE_WEBHOOK_SECRET)
const stripeWebhookController = require('./server/controllers/stripeWebhookController');
app.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhookController.handle);

app.use(express.json());
trace('middleware ready');

const stripeCheckoutElementsRoutes = require('./server/routes/stripeCheckoutElements');
app.use('/api/stripe', stripeCheckoutElementsRoutes);
trace('stripe checkout elements routes mounted');

const stripePlatformRoutes = require('./server/routes/stripePlatform');
app.use('/api/stripe-admin/v1', stripePlatformRoutes);
trace('stripe admin platform routes mounted');

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
mountSafe('/api/clients', './server/routes/clients');
mountSafe('/api/admins', './server/routes/admins');
mountSafe('/api/service-categories', './server/routes/serviceCategories');
mountSafe('/api/providers', './server/routes/providers');
mountSafe('/api/service-requests', './server/routes/serviceRequests');
const offerRespondRoutes = require('./server/routes/offerRespond');
app.use('/api/offers', offerRespondRoutes);
mountSafe('/api/offers', './server/routes/offers');
mountSafe('/api/payments', './server/routes/payments');
mountSafe('/api/escrow', './server/routes/escrow');
mountSafe('/api/reviews', './server/routes/reviews');
mountSafe('/api/messages', './server/routes/messages');
mountSafe('/api/service-items', './server/routes/serviceItems');
mountSafe('/api/provider-availabilities', './server/routes/providerAvailabilities');
mountSafe('/api/bookings', './server/routes/bookings');
mountSafe('/api/favorites', './server/routes/favorites');
mountSafe('/api/functions', './server/routes/functions');
mountSafe('/api/upload', './server/routes/upload');
mountSafe('/api/demandes', './server/routes/demandes');
mountSafe('/api/admin/demandes', './server/routes/adminDemandes');
mountSafe('/api/provider/demandes', './server/routes/providerDemandes');
mountSafe('/api/platform-reviews', './server/routes/platformReviews');
mountSafe('/api/notifications', './server/routes/notifications');
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  trace(`express error: ${err.message || 'unknown'}`);
  const publicMessage = isProd
    ? 'Internal server error'
    : err.message || 'Internal server error';
  res.status(500).json({ error: publicMessage });
});

process.on('unhandledRejection', (reason) => {
  trace(`unhandledRejection: ${reason && reason.stack ? reason.stack : String(reason)}`);
});
process.on('uncaughtException', (err) => {
  trace(`uncaughtException: ${err && err.stack ? err.stack : String(err)}`);
});

const { runStartupTasks } = require('./server/services/startupService');

runStartupTasks()
  .catch((e) => trace(`[startup] error: ${e.message}`))
  .finally(() => {
    app.listen(PORT, '0.0.0.0', () => {
      trace(`listening on ${PORT}`);
      if (!quietLogs) console.log(`[API] By Excellence backend running on port ${PORT}`);
    });
  });

// Nightly payment reminder cron — runs every day at 02:00 server time
(function schedulePaymentReminders() {
  const { sendPaymentReminders } = require('./server/services/paymentRemindersService');

  function msUntil2am() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(2, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }

  function runAndReschedule() {
    sendPaymentReminders()
      .then((r) => trace(`[cron] payment reminders: ${JSON.stringify(r)}`))
      .catch((e) => trace(`[cron] payment reminders error: ${e.message}`));
    setTimeout(runAndReschedule, 24 * 60 * 60 * 1000);
  }

  setTimeout(runAndReschedule, msUntil2am());
  trace(`[cron] payment reminders scheduled — first run in ${Math.round(msUntil2am() / 60000)} min`);
}());
