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

module.exports = pool;