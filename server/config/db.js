const mysql = require('mysql2/promise');

var db_config = {
socketPath: '/srv/run/mysqld/mysqld.sock',
user: 'root',
password: '',
database: 'default_db',
waitForConnections: true,
connectionLimit: 10,
queueLimit: 0,
timezone: 'Z',
charset: 'utf8mb4_unicode_ci',
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: '',//process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'by_excellence',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',
});

//const pool = mysql.createPool(db_config);

module.exports = pool;
