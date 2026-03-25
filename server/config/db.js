const mysql = require('mysql2/promise');

const dbConfig = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'by_excellence',
  charset: 'utf8mb4_unicode_ci',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  timezone: 'Z',
};

// Prefer unix socket when explicitly provided (common on shared hosting).
// If socketPath isn't set and DB_HOST isn't set either, default to the common Gandi socket.
if (process.env.DB_SOCKET_PATH) {
  dbConfig.socketPath = process.env.DB_SOCKET_PATH;
} else if (process.env.DB_HOST) {
  dbConfig.host = process.env.DB_HOST || '127.0.0.1';
  dbConfig.port = Number(process.env.DB_PORT || 3306);
} else {
  dbConfig.socketPath = '/srv/run/mysqld/mysqld.sock';
}

const pool = mysql.createPool(dbConfig);

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('[DB] Database connected successfully.');
    conn.release();
  } catch (err) {
    console.error('[DB] Database connection failed:', {
      message: err?.message,
      code: err?.code,
      errno: err?.errno,
      syscall: err?.syscall,
      address: err?.address,
      port: err?.port,
      stack: err?.stack,
    });
    console.warn('[DB] Server will continue running. DB operations may fail until DB is reachable.');
  }
}

// Run test at startup, but don’t block server
testConnection();

module.exports = pool;