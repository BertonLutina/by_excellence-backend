const { executeSQL } = require('../db/db');

async function run() {
  await executeSQL(`
    ALTER TABLE service_items
      ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR(255) NULL AFTER image_url,
      ADD COLUMN IF NOT EXISTS stripe_price_id   VARCHAR(255) NULL AFTER stripe_product_id
  `);
  console.log('✓ stripe_product_id and stripe_price_id columns added to service_items');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
