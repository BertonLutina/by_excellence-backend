/* eslint-disable prettier/prettier */
const pool = require('../config/db');

/**
 * Execute SQL.
 * SELECT -> rows array
 * INSERT/UPDATE/DELETE -> result object (insertId, affectedRows, ...)
 */
async function executeSQL(sql, values = []) {
  const [result] = await pool.execute(sql, values);
  return result;
}

module.exports = { executeSQL };
