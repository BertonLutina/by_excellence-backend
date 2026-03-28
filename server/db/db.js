/* eslint-disable prettier/prettier */
const pool = require('../config/db');

/**
 * mysql2 / MySQL reject `undefined` in bound parameters; use SQL NULL.
 * BigInt (e.g. insertId) is coerced to Number for libmysqlclient compatibility.
 */
function normalizeBindings(values) {
  if (!Array.isArray(values)) return values;
  return values.map((v) => {
    if (v === undefined) return null;
    if (typeof v === 'number' && Number.isNaN(v)) return null;
    if (typeof v === 'bigint') return Number(v);
    return v;
  });
}

/**
 * Execute SQL.
 * SELECT -> rows array
 * INSERT/UPDATE/DELETE -> result object (insertId, affectedRows, ...)
 */
async function executeSQL(sql, values = []) {
  const [result] = await pool.execute(sql, normalizeBindings(values));
  return result;
}

module.exports = { executeSQL, normalizeBindings };
