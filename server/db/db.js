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
const EXECUTESQL = (p_sql, p_values) => {
  return new Promise((resolve, reject) => {
      pool.query(p_sql, p_values, function (err, result) {
          if (err) {
              console.error('err', err);
              reject(err);
          }
          resolve(result);
          console.log('connected to the database')
      });
  });
};
module.exports = { executeSQL, EXECUTESQL };
