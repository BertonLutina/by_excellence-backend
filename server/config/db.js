const mysql = require('mysql2/promise');
const {
  DB_SOCKET_PATH,
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_CONNECTION_LIMIT,
} = require('./constant');

const db_config = {
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  charset: 'utf8mb4_unicode_ci',
  connectionLimit: DB_CONNECTION_LIMIT,
};

if (DB_SOCKET_PATH) {
  db_config.socketPath = DB_SOCKET_PATH;
} else {
  db_config.host = DB_HOST || '127.0.0.1';
  db_config.port = DB_PORT;
}

const pool = mysql.createPool(db_config);

module.exports = pool;