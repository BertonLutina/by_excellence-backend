/**
 * Repairs providers.portfolio_images when values were saved as JSON strings
 * (e.g. stringified arrays) instead of JSON arrays/objects. Works on MySQL 8 and MariaDB 10.x.
 *
 * Run: node server/scripts/fix-portfolio-images-json.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../config/db');

/**
 * If mysql2 returns a string that parses to an array/object, return the parsed value to store as JSON.
 * Returns null when no change is needed.
 */
function coerceStoredPortfolioImages(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s || (s[0] !== '[' && s[0] !== '{')) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }
  return null;
}

async function run() {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, portfolio_images FROM providers
       WHERE portfolio_images IS NOT NULL
         AND JSON_TYPE(portfolio_images) = 'STRING'`
    );

    let updated = 0;
    for (const row of rows) {
      const next = coerceStoredPortfolioImages(row.portfolio_images);
      if (next === null) continue;
      // MariaDB/mysql2: binding a JS array to JSON can trigger ER_WRONG_ARGUMENTS; bind JSON text.
      await conn.execute('UPDATE providers SET portfolio_images = ? WHERE id = ?', [
        JSON.stringify(next),
        row.id,
      ]);
      updated += 1;
      console.log(`id=${row.id}: unwrapped string portfolio_images -> JSON`);
    }

    console.log(`Done. Updated ${updated} row(s).`);
    process.exit(0);
  } catch (err) {
    console.error('fix-portfolio-images-json failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    pool.end();
  }
}

run();
