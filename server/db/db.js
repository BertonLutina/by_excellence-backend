/* eslint-disable prettier/prettier */
const pool = require('../config/db');

/**
 * Execute SQL. Returns: SELECT -> rows (array); INSERT/UPDATE/DELETE -> result (has insertId for INSERT).
 */
async function executeSQL(sql, values = []) {
  const [result] = await pool.execute(sql, values);
  return result;
}

module.exports = { executeSQL };
