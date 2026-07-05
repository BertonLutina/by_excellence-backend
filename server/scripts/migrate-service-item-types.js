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

async function indexExists(table, indexName) {
  const rows = await executeSQL(
    `SELECT COUNT(*) AS n FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, indexName]
  );
  const arr = Array.isArray(rows) ? rows : [];
  return Number(arr[0]?.n || 0) > 0;
}

async function addColumnIfMissing(table, column, ddl) {
  if (await columnExists(table, column)) {
    console.log(`✓ ${table}.${column} already exists — skip`);
    return;
  }
  await executeSQL(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
  console.log(`✓ ${table}.${column} added`);
}

async function addIndexIfMissing(table, indexName, ddl) {
  if (await indexExists(table, indexName)) {
    console.log(`✓ ${table}.${indexName} already exists — skip`);
    return;
  }
  await executeSQL(`ALTER TABLE \`${table}\` ADD INDEX ${ddl}`);
  console.log(`✓ ${table}.${indexName} added`);
}

async function run() {
  await addColumnIfMissing(
    'service_items',
    'item_type',
    "item_type ENUM('service','package') NOT NULL DEFAULT 'package' AFTER provider_id"
  );
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
  await addIndexIfMissing(
    'service_items',
    'idx_service_item_type',
    'idx_service_item_type (item_type)'
  );
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
