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

if (process.env.DB_SOCKET_PATH) {
  dbConfig.socketPath = process.env.DB_SOCKET_PATH;
} else {
  dbConfig.host = process.env.DB_HOST || 'localhost';
  dbConfig.port = Number(process.env.DB_PORT || 3306);
}

const pool = mysql.createPool(dbConfig);

module.exports = pool;