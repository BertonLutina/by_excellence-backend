const mysql = require('mysql2/promise');

const isProd = process.env.NODE_ENV === 'production';
const quietLogs = isProd && (process.env.LOG_LEVEL || 'error') === 'error';

const dbConfig = {
  user: 'root',
  password:'',
  database: 'by_excellence',
  charset: 'utf8mb4_unicode_ci',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  timezone: 'Z',
};

if (process.env.DB_SOCKET_PATH) {
  dbConfig.socketPath = process.env.DB_SOCKET_PATH;
} else if (process.env.DB_HOST) {
  dbConfig.host = process.env.DB_HOST;
  dbConfig.port = Number(process.env.DB_PORT || 3306);
} else {
  dbConfig.socketPath = '/srv/run/mysqld/mysqld.sock';
}

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