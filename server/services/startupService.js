const { executeSQL } = require('../db/db');
const { getStripe } = require('../utils/stripeClient');
const { FRONTEND_ORIGIN, APP_URL } = require('../../constants/constant');

// Each migration: { table, column, ddl } — ddl is the column definition
// (everything that goes after `ADD COLUMN`).
// We check information_schema first because MySQL (unlike MariaDB) does NOT
// support `ADD COLUMN IF NOT EXISTS` — it raises a syntax error.
const MIGRATIONS = [
  { table: 'payments',      column: 'due_date',          ddl: 'due_date DATETIME NULL AFTER paid_date' },
  { table: 'service_items', column: 'item_type',          ddl: "item_type ENUM('service','package') NOT NULL DEFAULT 'package' AFTER provider_id" },
  { table: 'service_items', column: 'stripe_product_id', ddl: 'stripe_product_id VARCHAR(255) NULL AFTER image_url' },
  { table: 'service_items', column: 'stripe_price_id',   ddl: 'stripe_price_id VARCHAR(255) NULL AFTER stripe_product_id' },
  { table: 'providers',     column: 'lat',               ddl: 'lat DECIMAL(10,7) NULL' },
  { table: 'providers',     column: 'lng',               ddl: 'lng DECIMAL(10,7) NULL' },
  // Per-offer chat thread (admin <-> provider) — separate from per-request chat (client <-> admin/provider).
  { table: 'messages',      column: 'offer_id',          ddl: 'offer_id BIGINT UNSIGNED NULL AFTER request_id' },
  { table: 'platform_reviews', column: 'author_profession', ddl: 'author_profession VARCHAR(150) NULL AFTER author_full_name' },
  { table: 'platform_reviews', column: 'author_location',   ddl: 'author_location VARCHAR(100) NULL AFTER author_profession' },
  { table: 'platform_reviews', column: 'author_user_id',    ddl: 'author_user_id BIGINT UNSIGNED NULL AFTER author_role' },
  { table: 'provider_availability', column: 'slot_date',    ddl: 'slot_date DATE NULL AFTER provider_id' },
  { table: 'provider_availability', column: 'booking_type', ddl: "booking_type ENUM('time_slot','full_day') NOT NULL DEFAULT 'time_slot' AFTER is_available" },
  { table: 'provider_availability', column: 'program_note', ddl: 'program_note VARCHAR(280) NULL AFTER booking_type' },
  { table: 'providers', column: 'website_url',   ddl: 'website_url VARCHAR(500) NULL AFTER video_url' },
  { table: 'providers', column: 'facebook_url',  ddl: 'facebook_url VARCHAR(500) NULL AFTER website_url' },
  { table: 'providers', column: 'instagram_url', ddl: 'instagram_url VARCHAR(500) NULL AFTER facebook_url' },
  { table: 'providers', column: 'tiktok_url',    ddl: 'tiktok_url VARCHAR(500) NULL AFTER instagram_url' },
  { table: 'providers', column: 'linkedin_url',  ddl: 'linkedin_url VARCHAR(500) NULL AFTER tiktok_url' },
  { table: 'providers', column: 'youtube_url',   ddl: 'youtube_url VARCHAR(500) NULL AFTER linkedin_url' },
  { table: 'providers', column: 'social_reels',  ddl: 'social_reels JSON NULL AFTER youtube_url' },
  { table: 'service_requests', column: 'selected_items', ddl: 'selected_items JSON NULL AFTER combo_payload' },
  { table: 'service_requests', column: 'is_open_request', ddl: 'is_open_request BOOLEAN NOT NULL DEFAULT FALSE AFTER is_combo' },
  { table: 'offers', column: 'commission_mode', ddl: "commission_mode ENUM('included','on_top') NOT NULL DEFAULT 'included' AFTER deposit_percentage" },
  { table: 'offers', column: 'payment_flow', ddl: "payment_flow ENUM('deposit_flow','direct_full_payment') NOT NULL DEFAULT 'deposit_flow' AFTER commission_mode" },
  { table: 'users', column: 'email_notifications', ddl: 'email_notifications JSON NULL AFTER is_email_verified' },
  { table: 'users', column: 'in_app_notifications', ddl: 'in_app_notifications JSON NULL AFTER email_notifications' },
  { table: 'service_categories', column: 'category_type', ddl: "category_type ENUM('service','goods','both') NOT NULL DEFAULT 'service' AFTER image_url" },
  { table: 'service_categories', column: 'is_active', ddl: 'is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER category_type' },
  { table: 'providers', column: 'activity_type', ddl: "activity_type ENUM('service','goods','both') NOT NULL DEFAULT 'service' AFTER category_id" },
  { table: 'providers', column: 'suggested_category_name', ddl: 'suggested_category_name VARCHAR(150) NULL AFTER activity_type' },
  { table: 'providers', column: 'suggested_category_type', ddl: "suggested_category_type ENUM('service','goods','both') NULL AFTER suggested_category_name" },
  { table: 'service_items', column: 'unit', ddl: 'unit VARCHAR(50) NULL AFTER duration' },
  { table: 'service_items', column: 'stock_quantity', ddl: 'stock_quantity INT UNSIGNED NULL AFTER unit' },
  { table: 'service_items', column: 'min_order_quantity', ddl: 'min_order_quantity INT UNSIGNED NULL AFTER stock_quantity' },
  { table: 'service_requests', column: 'partnership_id', ddl: 'partnership_id BIGINT UNSIGNED NULL AFTER selected_items' },
  { table: 'offers', column: 'partnership_id', ddl: 'partnership_id BIGINT UNSIGNED NULL AFTER payment_flow' },
  { table: 'offers', column: 'partnership_split', ddl: 'partnership_split JSON NULL AFTER partnership_id' },
  { table: 'providers', column: 'career_highlights', ddl: 'career_highlights JSON NULL AFTER portfolio_images' },
  { table: 'providers', column: 'photo_original_url', ddl: 'photo_original_url TEXT NULL AFTER banner_url' },
  { table: 'providers', column: 'banner_original_url', ddl: 'banner_original_url TEXT NULL AFTER photo_original_url' },
  { table: 'providers', column: 'photo_crop', ddl: 'photo_crop JSON NULL AFTER banner_original_url' },
  { table: 'providers', column: 'banner_crop', ddl: 'banner_crop JSON NULL AFTER photo_crop' },
  // provider_payouts is created by ensureProviderPayoutsTable before these run.
  // Columns are listed so an existing partial table still receives them.
  { table: 'provider_payouts', column: 'payment_id', ddl: 'payment_id BIGINT UNSIGNED NOT NULL' },
  { table: 'provider_payouts', column: 'provider_id', ddl: 'provider_id BIGINT UNSIGNED NOT NULL' },
  { table: 'provider_payouts', column: 'amount', ddl: 'amount DECIMAL(10,2) NOT NULL' },
  { table: 'provider_payouts', column: 'currency', ddl: "currency CHAR(3) NOT NULL DEFAULT 'EUR'" },
  { table: 'provider_payouts', column: 'status', ddl: "status ENUM('to_pay','paid') NOT NULL DEFAULT 'to_pay'" },
  { table: 'provider_payouts', column: 'created_by', ddl: 'created_by BIGINT UNSIGNED NOT NULL' },
  { table: 'provider_payouts', column: 'paid_at', ddl: 'paid_at DATETIME NULL' },
  { table: 'provider_payouts', column: 'paid_by', ddl: 'paid_by BIGINT UNSIGNED NULL' },
  { table: 'provider_payouts', column: 'bank_reference', ddl: 'bank_reference VARCHAR(140) NULL' },
  { table: 'payments', column: 'stripe_fee_amount', ddl: 'stripe_fee_amount DECIMAL(10,2) NULL' },
  { table: 'clients', column: 'vat_number', ddl: 'vat_number VARCHAR(50) NULL AFTER phone' },
  { table: 'providers', column: 'phone', ddl: 'phone VARCHAR(50) NULL AFTER city' },
];

// Indexes added after columns; the same `IF NOT EXISTS` issue applies, so we
// check information_schema.statistics first.
const INDEX_MIGRATIONS = [
  { table: 'messages', name: 'idx_message_offer', columns: ['offer_id'] },
  { table: 'service_items', name: 'idx_service_item_type', columns: ['item_type'] },
  { table: 'provider_availability', name: 'idx_availability_slot_date', columns: ['provider_id', 'slot_date'] },
  { table: 'offers', name: 'uq_offer_request_provider', columns: ['request_id', 'provider_id'], unique: true },
  { table: 'service_requests', name: 'idx_request_partnership', columns: ['partnership_id'] },
  { table: 'offers', name: 'idx_offer_partnership', columns: ['partnership_id'] },
  { table: 'provider_payouts', name: 'uq_provider_payout_payment', columns: ['payment_id'], unique: true },
  { table: 'provider_payouts', name: 'idx_provider_payout_status', columns: ['status'] },
  { table: 'provider_payouts', name: 'idx_provider_payout_provider', columns: ['provider_id'] },
];

async function indexExists(table, name) {
  try {
    const rows = await executeSQL(
      `SELECT COUNT(*) AS n FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
      [table, name]
    );
    const arr = Array.isArray(rows) ? rows : [];
    return Number(arr[0]?.n || 0) > 0;
  } catch (e) {
    console.warn(`[startup] indexExists check failed for ${table}.${name}:`, e.message);
    return false;
  }
}

async function columnExists(table, column) {
  try {
    const rows = await executeSQL(
      `SELECT COUNT(*) AS n FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [table, column]
    );
    const arr = Array.isArray(rows) ? rows : [];
    const n = Number(arr[0]?.n || 0);
    return n > 0;
  } catch (e) {
    console.warn(`[startup] columnExists check failed for ${table}.${column}:`, e.message);
    return false;
  }
}

async function columnType(table, column) {
  try {
    const rows = await executeSQL(
      `SELECT COLUMN_TYPE AS column_type FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [table, column]
    );
    const arr = Array.isArray(rows) ? rows : [];
    return arr[0]?.column_type || null;
  } catch (e) {
    console.warn(`[startup] columnType check failed for ${table}.${column}:`, e.message);
    return null;
  }
}

async function runEnumWideningMigrations() {
  try {
    const itemType = await columnType('service_items', 'item_type');
    if (itemType && !itemType.includes("'good'")) {
      await executeSQL("ALTER TABLE `service_items` MODIFY `item_type` ENUM('service','package','good') NOT NULL DEFAULT 'package'");
      console.log('[startup] enum widened: service_items.item_type includes good');
    }
  } catch (e) {
    console.error('[startup] enum widening failed (service_items.item_type):', e.message);
  }

  try {
    const paymentType = await columnType('payments', 'type');
    if (paymentType && !paymentType.includes("'goods_full'")) {
      await executeSQL("ALTER TABLE `payments` MODIFY `type` ENUM('deposit','final','installment','goods_full') NOT NULL");
      console.log('[startup] enum widened: payments.type includes goods_full');
    }
  } catch (e) {
    console.error('[startup] enum widening failed (payments.type):', e.message);
  }
}

async function runMigrations() {
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of MIGRATIONS) {
    try {
      const exists = await columnExists(m.table, m.column);
      if (exists) {
        skipped += 1;
        continue;
      }
      await executeSQL(`ALTER TABLE \`${m.table}\` ADD COLUMN ${m.ddl}`);
      console.log(`[startup] migration applied: ${m.table}.${m.column}`);
      applied += 1;
    } catch (e) {
      // Race / pre-existing column from another instance — ignore "Duplicate column".
      if (e.message?.includes('Duplicate column')) {
        skipped += 1;
        continue;
      }
      console.error(`[startup] migration failed (${m.table}.${m.column}):`, e.message);
      failed += 1;
    }
  }

  console.log(`[startup] migrations done — applied: ${applied}, skipped: ${skipped}, failed: ${failed}`);

  for (const idx of INDEX_MIGRATIONS) {
    try {
      const exists = await indexExists(idx.table, idx.name);
      if (exists) continue;
      const cols = idx.columns.map((c) => `\`${c}\``).join(', ');
      const unique = idx.unique ? 'UNIQUE ' : '';
      await executeSQL(`ALTER TABLE \`${idx.table}\` ADD ${unique}INDEX \`${idx.name}\` (${cols})`);
      console.log(`[startup] index applied: ${idx.table}.${idx.name}`);
    } catch (e) {
      if (e.message?.includes('Duplicate key name')) continue;
      console.error(`[startup] index migration failed (${idx.table}.${idx.name}):`, e.message);
    }
  }
}

async function ensureStripeWebhook() {
  const stripe = getStripe();
  if (!stripe) return;

  const base = (FRONTEND_ORIGIN || APP_URL || '').replace(/\/$/, '');
  if (!base || base.startsWith('http://localhost')) return;

  const webhookUrl = `${base}/api/stripe/webhook`;
  // Cover both card (sync) and async methods (SEPA, virement, etc.).
  const requiredEvents = [
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
  ];

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
      const q = `${city}, Belgique`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1&countrycodes=be`;
      https.get(url, { headers: { 'User-Agent': 'ByExcellence/1.0 (contact@by-excellence.com)' } }, (res) => {
        let body = '';
        res.on('data', (d) => body += d);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const PLACE = new Set(['city','town','village','municipality','administrative']);
            const hit =
              data.find((r) => r.address?.country_code === 'be') ||
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

async function ensurePlatformReviewsTable() {
  try {
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS \`platform_reviews\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`author_full_name\` VARCHAR(150) DEFAULT NULL,
        \`author_profession\` VARCHAR(150) DEFAULT NULL,
        \`author_location\` VARCHAR(100) DEFAULT NULL,
        \`author_role\` ENUM('client','provider') DEFAULT 'client',
        \`author_user_id\` BIGINT UNSIGNED DEFAULT NULL,
        \`rating\` TINYINT UNSIGNED NOT NULL DEFAULT 5,
        \`comment\` TEXT NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_date\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_pr_rating\` (\`rating\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[startup] platform_reviews table ready');
  } catch (e) {
    console.warn('[startup] platform_reviews table creation failed:', e.message);
  }
}

async function ensureNotificationsTable() {
  try {
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS \`notifications\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` BIGINT UNSIGNED NOT NULL,
        \`type\` VARCHAR(100) NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`body\` TEXT NOT NULL,
        \`payload\` JSON NULL,
        \`is_read\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_notifications_user\` (\`user_id\`),
        INDEX \`idx_notifications_read\` (\`is_read\`),
        CONSTRAINT \`fk_notifications_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[startup] notifications table ready');
  } catch (e) {
    console.warn('[startup] notifications table creation failed:', e.message);
  }
}

async function ensureOpenRequestProviderNullable() {
  try {
    const rows = await executeSQL(
      `SELECT IS_NULLABLE AS nullable FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'service_requests' AND column_name = 'provider_id'`
    );
    const nullable = (Array.isArray(rows) ? rows[0] : rows)?.nullable;
    if (nullable === 'NO') {
      await executeSQL('ALTER TABLE `service_requests` MODIFY `provider_id` BIGINT UNSIGNED NULL');
      console.log('[startup] service_requests.provider_id is now nullable (open requests)');
    }
  } catch (e) {
    console.warn('[startup] open request provider_id migration:', e.message);
  }
}

async function ensurePartnershipsTables() {
  try {
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS \`provider_partnerships\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`lead_provider_id\` BIGINT UNSIGNED NOT NULL,
        \`partner_provider_id\` BIGINT UNSIGNED NOT NULL,
        \`status\` ENUM('invited','accepted','declined','paused','ended','expired') NOT NULL DEFAULT 'invited',
        \`starts_at\` DATETIME NULL,
        \`ends_at\` DATETIME NULL,
        \`scope_type\` ENUM('all','items') NOT NULL DEFAULT 'all',
        \`lead_share_percent\` DECIMAL(5,2) NOT NULL DEFAULT 50.00,
        \`is_public\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`combo_title\` VARCHAR(255) NULL,
        \`combo_description\` TEXT NULL,
        \`combo_price_from\` DECIMAL(10,2) NULL,
        \`combo_image_url\` VARCHAR(500) NULL,
        \`contract_version\` VARCHAR(32) NOT NULL DEFAULT 'v1',
        \`lead_contract_accepted_at\` DATETIME NULL,
        \`partner_contract_accepted_at\` DATETIME NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_pp_lead\` (\`lead_provider_id\`, \`status\`),
        INDEX \`idx_pp_partner\` (\`partner_provider_id\`, \`status\`),
        CONSTRAINT \`fk_pp_lead\` FOREIGN KEY (\`lead_provider_id\`) REFERENCES \`providers\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_pp_partner\` FOREIGN KEY (\`partner_provider_id\`) REFERENCES \`providers\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS \`provider_partnership_items\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`partnership_id\` BIGINT UNSIGNED NOT NULL,
        \`service_item_id\` BIGINT UNSIGNED NULL,
        \`owner_provider_id\` BIGINT UNSIGNED NOT NULL,
        INDEX \`idx_ppi_partnership\` (\`partnership_id\`),
        CONSTRAINT \`fk_ppi_partnership\` FOREIGN KEY (\`partnership_id\`) REFERENCES \`provider_partnerships\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_ppi_item\` FOREIGN KEY (\`service_item_id\`) REFERENCES \`service_items\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_ppi_owner\` FOREIGN KEY (\`owner_provider_id\`) REFERENCES \`providers\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[startup] provider_partnerships tables ready');
  } catch (e) {
    console.warn('[startup] provider_partnerships table creation failed:', e.message);
  }
}

async function ensureCollaboratorsTable() {
  try {
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS \`service_request_collaborators\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`request_id\` BIGINT UNSIGNED NOT NULL,
        \`provider_id\` BIGINT UNSIGNED NOT NULL,
        \`role\` ENUM('lead','partner') NOT NULL DEFAULT 'partner',
        \`status\` ENUM('invited','accepted','declined','removed') NOT NULL DEFAULT 'invited',
        \`note\` TEXT NULL,
        \`invited_by_provider_id\` BIGINT UNSIGNED NULL,
        \`invited_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`responded_at\` TIMESTAMP NULL,
        UNIQUE KEY \`uq_request_collaborator\` (\`request_id\`, \`provider_id\`),
        INDEX \`idx_collab_provider\` (\`provider_id\`, \`status\`),
        CONSTRAINT \`fk_collab_request\` FOREIGN KEY (\`request_id\`) REFERENCES \`service_requests\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_collab_provider\` FOREIGN KEY (\`provider_id\`) REFERENCES \`providers\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[startup] service_request_collaborators table ready');
  } catch (e) {
    console.warn('[startup] service_request_collaborators table creation failed:', e.message);
  }
}

async function migrateProviderAvailabilityIndexes() {
  try {
    const rows = await executeSQL(
      `SELECT COUNT(*) AS n FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'provider_availability' AND index_name = 'uq_provider_day'`
    );
    const n = Number((Array.isArray(rows) ? rows[0] : rows)?.n || 0);
    if (n > 0) {
      await executeSQL('ALTER TABLE `provider_availability` DROP INDEX `uq_provider_day`');
      console.log('[startup] dropped provider_availability.uq_provider_day');
    }
  } catch (e) {
    console.warn('[startup] provider_availability index migration:', e.message);
  }
}

async function ensurePersonalPlanningTable() {
  try {
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS \`personal_planning_items\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` BIGINT UNSIGNED NOT NULL,
        \`title\` VARCHAR(200) NOT NULL,
        \`notes\` TEXT NULL,
        \`plan_date\` DATE NULL,
        \`start_time\` TIME NULL,
        \`end_time\` TIME NULL,
        \`is_done\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_personal_planning_user_date\` (\`user_id\`, \`plan_date\`),
        INDEX \`idx_personal_planning_user_done\` (\`user_id\`, \`is_done\`),
        CONSTRAINT \`fk_personal_planning_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[startup] personal_planning_items table ready');
  } catch (e) {
    console.warn('[startup] personal_planning_items table creation failed:', e.message);
  }
}

async function ensureProviderPayoutsTable() {
  try {
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS \`provider_payouts\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`payment_id\` BIGINT UNSIGNED NOT NULL,
        \`provider_id\` BIGINT UNSIGNED NOT NULL,
        \`amount\` DECIMAL(10,2) NOT NULL,
        \`currency\` CHAR(3) NOT NULL DEFAULT 'EUR',
        \`status\` ENUM('to_pay','paid') NOT NULL DEFAULT 'to_pay',
        \`created_by\` BIGINT UNSIGNED NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`paid_at\` DATETIME NULL,
        \`paid_by\` BIGINT UNSIGNED NULL,
        \`bank_reference\` VARCHAR(140) NULL,
        UNIQUE KEY \`uq_provider_payout_payment\` (\`payment_id\`),
        INDEX \`idx_provider_payout_status\` (\`status\`),
        INDEX \`idx_provider_payout_provider\` (\`provider_id\`),
        CONSTRAINT \`fk_payout_payment\` FOREIGN KEY (\`payment_id\`) REFERENCES \`payments\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_payout_provider\` FOREIGN KEY (\`provider_id\`) REFERENCES \`providers\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_payout_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_payout_paid_by\` FOREIGN KEY (\`paid_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[startup] provider_payouts table ready');
  } catch (e) {
    console.warn('[startup] provider_payouts table creation failed:', e.message);
  }
}

async function runStartupTasks() {
  await ensurePlatformReviewsTable();
  await ensureNotificationsTable();
  await ensureCollaboratorsTable();
  await ensurePartnershipsTables();
  await ensureProviderPayoutsTable();
  await ensurePersonalPlanningTable();
  await runMigrations();
  await runEnumWideningMigrations();
  await ensureOpenRequestProviderNullable();
  await migrateProviderAvailabilityIndexes();
  await ensureStripeWebhook();
  // Non-blocking — runs in background after server is up
  geocodeProviders().catch((e) => console.warn('[startup] geocodeProviders error:', e.message));
}

module.exports = { runStartupTasks };
