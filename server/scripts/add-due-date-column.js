const { executeSQL } = require('../db/db');

(async () => {
  try {
    await executeSQL('ALTER TABLE payments ADD COLUMN IF NOT EXISTS due_date DATETIME NULL AFTER paid_date');
    console.log('Migration OK: due_date column added');
  } catch (e) {
    if (e.message && e.message.includes('Duplicate column')) {
      console.log('Column already exists — OK');
    } else {
      console.error('Migration failed:', e.message);
      process.exit(1);
    }
  }
  process.exit(0);
})();
