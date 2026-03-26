const NODE_ENV = 'production';
const LOG_LEVEL = 'error';
const IS_PROD = NODE_ENV === 'production';

module.exports = {
  NODE_ENV,
  IS_PROD,
  LOG_LEVEL,
  QUIET_LOGS: IS_PROD && LOG_LEVEL === 'error',
  PORT: 8080,
  APP_URL: 'https://byexcellence-as.com',
  API_BASE_URL: 'https://byexcellence-as.com',
  FRONTEND_ORIGIN: 'https://byexcellence-as.com',
  CORS_ORIGINS: 'https://byexcellence-as.com',
  JWT_SECRET: 'CHANGE_ME_WITH_A_REAL_SECRET',
  JWT_EXPIRES_IN: '7d',
  UPLOAD_DIR: '/srv/data/web/vhosts/default/uploads',
  DB_SOCKET_PATH: '/srv/run/mysqld/mysqld.sock',
  DB_HOST: '',
  DB_PORT: 3306,
  DB_USER: 'root',
  DB_PASSWORD: '',
  DB_NAME: 'by_excellence',
  DB_CONNECTION_LIMIT: 10,
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: 587,
  SMTP_SECURE: false,
  SMTP_USER: 'your@gmail.com',
  SMTP_PASS: 'your_app_password',
  SMTP_FROM: '"By Excellence" <your@gmail.com>',
  COMMISSION_STANDARD_PERCENT: 15,
  COMMISSION_PREMIUM_DEFAULT_PERCENT: 20,
};
