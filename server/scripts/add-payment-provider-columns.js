/**
 * Idempotent migration: add multi-provider / multi-currency columns to payments.
 *   - payment_provider : which gateway handled it ('stripe' | 'flutterwave' | ...)
 *   - currency         : ISO 4217 code (defaults to existing behavior if unset)
 *   - provider_ref     : gateway transaction/session id (for reconciliation)
 *
 * Run: node server/scripts/add-payment-provider-columns.js
 */
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

async function addColumn(column, ddl) {
  if (await columnExists('payments', column)) {
    console.log(`Column payments.${column} already exists — OK`);
    return;
  }
  await executeSQL(`ALTER TABLE payments ADD COLUMN ${ddl}`);
  console.log(`Migration OK: ${column} column added`);
}

(async () => {
  try {
    await addColumn('payment_provider', "payment_provider VARCHAR(32) NULL AFTER payment_method");
    await addColumn('currency', "currency CHAR(3) NULL AFTER payment_provider");
    await addColumn('provider_ref', "provider_ref VARCHAR(191) NULL AFTER currency");
    console.log('All payment provider columns present.');
    process.exit(0);
  } catch (e) {
    if (e.message && e.message.includes('Duplicate column')) {
      console.log('Column already exists — OK');
      process.exit(0);
    }
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
})();
