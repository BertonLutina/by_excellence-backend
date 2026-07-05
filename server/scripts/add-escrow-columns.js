/**
 * Idempotent migration for escrow + disputes (Roadmap Phase 2).
 *   payments.escrow_status  : 'held' | 'disputed' | 'released' | 'refunded' | NULL
 *   payments.auto_release_at: when a held payment auto-releases if undisputed
 *   disputes                : one row per raised dispute
 *
 * Run: node server/scripts/add-escrow-columns.js
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

async function addColumn(table, column, ddl) {
  if (await columnExists(table, column)) {
    console.log(`Column ${table}.${column} already exists — OK`);
    return;
  }
  await executeSQL(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  console.log(`Migration OK: ${table}.${column} added`);
}

(async () => {
  try {
    await addColumn('payments', 'escrow_status', "escrow_status VARCHAR(16) NULL AFTER status");
    await addColumn('payments', 'auto_release_at', "auto_release_at DATETIME NULL AFTER escrow_status");

    await executeSQL(`
      CREATE TABLE IF NOT EXISTS disputes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        payment_id INT NOT NULL,
        request_id INT NULL,
        opened_by INT NULL,
        opened_by_role VARCHAR(16) NULL,
        reason TEXT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'open',
        resolution VARCHAR(16) NULL,
        resolved_by INT NULL,
        resolved_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_date DATETIME NULL,
        INDEX idx_disputes_payment (payment_id),
        INDEX idx_disputes_status (status)
      )
    `);
    console.log('Table disputes present.');
    console.log('Escrow migration complete.');
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
