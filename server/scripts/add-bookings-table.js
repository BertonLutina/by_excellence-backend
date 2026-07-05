/**
 * Idempotent migration: bookings table (Roadmap Phase 6).
 * Run: node server/scripts/add-bookings-table.js
 */
const { executeSQL } = require('../db/db');

(async () => {
  try {
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NULL,
        offer_id INT NULL,
        provider_id INT NOT NULL,
        client_id INT NULL,
        slot_date DATE NOT NULL,
        start_time VARCHAR(5) NOT NULL,
        end_time VARCHAR(5) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'requested',
        cancelled_by INT NULL,
        cancel_reason VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_date DATETIME NULL,
        INDEX idx_bookings_provider_date (provider_id, slot_date),
        INDEX idx_bookings_status (status)
      )
    `);
    console.log('Migration OK: bookings table present.');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
})();
