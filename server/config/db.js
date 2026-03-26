const mysql = require('mysql2/promise');

const isProd = process.env.NODE_ENV === 'production';
const quietLogs = isProd && (process.env.LOG_LEVEL || 'error') === 'error';

const dbConfig = {
  socketPath :'/srv/run/mysqld/mysqld.sock',
  user: 'root',
  password:'',
  database:'by_excellence',
  waitForConnections: true,
  timezone: 'Z',
};

const pool = mysql.createPool(dbConfig);

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    if (!quietLogs) console.log('[DB] Database connected successfully.');
    conn.release();
  } catch (err) {
    console.error('[DB] Database connection failed:', err.message || err.code || 'unknown');
    if (!quietLogs) {
      console.warn('[DB] Server will continue running. DB operations may fail until DB is reachable.');
    }
  }
}

// Run test at startup, but don’t block server
testConnection();

module.exports = pool;