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

async function geocodeProviders() {
  const https = require('https');
  const rows = await executeSQL(
    `SELECT id, city FROM providers WHERE city IS NOT NULL AND city != '' AND (lat IS NULL OR lng IS NULL) LIMIT 200`
  );
  if (!rows?.length) return;
  console.log(`[startup] geocoding ${rows.length} provider(s) missing coords…`);

  function nominatim(city) {
    return new Promise((resolve) => {
      const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&format=json&limit=10&addressdetails=1&countrycodes=be,fr,nl,de,ch,lu,gb,it,es,pt`;
      https.get(url, { headers: { 'User-Agent': 'ByExcellence/1.0 (contact@by-excellence.com)' } }, (res) => {
        let body = '';
        res.on('data', (d) => body += d);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const PLACE = new Set(['city','town','village','municipality','administrative']);
            const hit =
              data.find((r) => r.class === 'place' && PLACE.has(r.type)) ||
              data.find((r) => r.class === 'boundary' && r.type === 'administrative') ||
              data[0];
            resolve(hit ? { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) } : null);
          } catch { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });
  }

  for (const row of rows) {
    try {
      const coords = await nominatim(row.city);
      if (coords) {
        await executeSQL('UPDATE providers SET lat=?, lng=? WHERE id=?', [coords.lat, coords.lng, row.id]);
        console.log(`[startup] geocoded provider #${row.id} (${row.city}) → ${coords.lat}, ${coords.lng}`);
      }
      // Nominatim rate limit: 1 req/sec
      await new Promise((r) => setTimeout(r, 1100));
    } catch (e) {
      console.warn(`[startup] geocode failed for provider #${row.id}:`, e.message);
    }
  }
  console.log('[startup] geocoding done');
}

async function runStartupTasks() {
  await runMigrations();
  await ensureStripeWebhook();
  // Non-blocking — runs in background after server is up
  geocodeProviders().catch((e) => console.warn('[startup] geocodeProviders error:', e.message));
}

module.exports = { runStartupTasks };
