const { executeSQL } = require('../db/db');

async function columnExists(table, column) {
  const rows = await executeSQL(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  const arr = Array.isArray(rows) ? rows : [];
  return Number(arr[0]?.n || 0) > 0;
}

async function addColumnIfMissing(table, column, ddlAfter) {
  if (await columnExists(table, column)) {
    console.log(`✓ ${table}.${column} already exists — skip`);
    return;
  }
  await executeSQL(`ALTER TABLE \`${table}\` ADD COLUMN ${ddlAfter}`);
  console.log(`✓ ${table}.${column} added`);
}

async function run() {
  await addColumnIfMissing(
    'service_items',
    'stripe_product_id',
    'stripe_product_id VARCHAR(255) NULL AFTER image_url'
  );
  await addColumnIfMissing(
    'service_items',
    'stripe_price_id',
    'stripe_price_id VARCHAR(255) NULL AFTER stripe_product_id'
  );
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
