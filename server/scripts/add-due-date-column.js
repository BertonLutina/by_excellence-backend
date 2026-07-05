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

(async () => {
  try {
    if (await columnExists('payments', 'due_date')) {
      console.log('Column payments.due_date already exists — OK');
      process.exit(0);
    }
    await executeSQL('ALTER TABLE payments ADD COLUMN due_date DATETIME NULL AFTER paid_date');
    console.log('Migration OK: due_date column added');
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
