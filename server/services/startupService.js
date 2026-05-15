const { executeSQL } = require('../db/db');
const { getStripe } = require('../utils/stripeClient');
const { FRONTEND_ORIGIN, APP_URL } = require('../../constants/constant');

const MIGRATIONS = [
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS due_date DATETIME NULL AFTER paid_date`,
  `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR(255) NULL AFTER image_url`,
  `ALTER TABLE service_items ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255) NULL AFTER stripe_product_id`,
  `ALTER TABLE providers ADD COLUMN IF NOT EXISTS lat DECIMAL(10,7) NULL`,
  `ALTER TABLE providers ADD COLUMN IF NOT EXISTS lng DECIMAL(10,7) NULL`,
];

async function runMigrations() {
  for (const sql of MIGRATIONS) {
    try {
      await executeSQL(sql);
    } catch (e) {
      if (!e.message?.includes('Duplicate column')) {
        console.error('[startup] migration failed:', sql, e.message);
      }
    }
  }
  console.log('[startup] migrations OK');
}

async function ensureStripeWebhook() {
  const stripe = getStripe();
  if (!stripe) return;

  const base = (FRONTEND_ORIGIN || APP_URL || '').replace(/\/$/, '');
  if (!base || base.startsWith('http://localhost')) return;

  const webhookUrl = `${base}/api/stripe/webhook`;
  const requiredEvents = ['checkout.session.completed'];

  try {
    const { data: existing } = await stripe.webhookEndpoints.list({ limit: 100 });
    const already = existing.find((w) => w.url === webhookUrl);
    if (already) {
      console.log('[startup] Stripe webhook already registered:', webhookUrl);
      return;
    }

    await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: requiredEvents,
    });
    console.log('[startup] Stripe webhook registered:', webhookUrl);
  } catch (e) {
    console.warn('[startup] Stripe webhook registration failed:', e.message);
  }
}

async function runStartupTasks() {
  await runMigrations();
  await ensureStripeWebhook();
}

module.exports = { runStartupTasks };
