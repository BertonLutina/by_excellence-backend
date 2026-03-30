const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const cwd = process.cwd();
const inferredGandiHosting =
  cwd.startsWith('/srv/data/web/vhosts') ||
  cwd.startsWith('/lamp0/web');
const runtimeNodeEnv = process.env.NODE_ENV || (inferredGandiHosting ? 'production' : 'development');

const candidateEnvPaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '.env.local'),
  path.join(process.cwd(), `.env.${runtimeNodeEnv}`),
  path.join(process.cwd(), `.env.${runtimeNodeEnv}.local`),
  path.join(process.cwd(), 'server', '.env'),
  path.join(process.cwd(), 'server', `.env.${runtimeNodeEnv}`),
  '/srv/data/web/vhosts/default/.env',
  '/lamp0/web/hosts/default/.env',
];

for (const p of candidateEnvPaths) {
  try {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p, override: true });
    }
  } catch {
    // ignore
  }
}

const IS_GANDI_HOSTING =
  Boolean(process.env.GANDI) ||
  inferredGandiHosting;

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const bool = (v, fallback) => {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
  return fallback;
};

const NODE_ENV = process.env.NODE_ENV || (IS_GANDI_HOSTING ? 'production' : 'development');

const IS_PROD = NODE_ENV === 'production';
const IS_DEV = NODE_ENV === 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PROD ? 'error' : 'debug');

const gandiHttpsBase = process.env.GANDI ? `https://${process.env.GANDI}` : '';

/** Development: API on localhost:8080. Production: from env or Gandi hostname. */
const defaultAppUrl = 'https://byexcellence-as.com';

const APP_URL = process.env.APP_URL || defaultAppUrl;
const API_BASE_URL = process.env.API_BASE_URL || APP_URL;

/** Development: Vite default. Production: same as public app unless overridden. */
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ;

let DB_SOCKET_PATH = process.env.DB_SOCKET_PATH || '';
const DB_HOST = process.env.DB_HOST || '';
if (!DB_SOCKET_PATH && !DB_HOST && IS_GANDI_HOSTING) {
  DB_SOCKET_PATH = '/srv/run/mysqld/mysqld.sock';
}

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ||
  (IS_DEV ? path.join(process.cwd(), 'uploads') : '/srv/data/web/vhosts/default/uploads');

module.exports = {
  IS_GANDI_HOSTING,
  IS_DEV,

  NODE_ENV,
  IS_PROD,
  LOG_LEVEL,
  QUIET_LOGS: IS_PROD && LOG_LEVEL === 'error',

  PORT: num(process.env.PORT, IS_DEV ? 8080 : 8080),

  APP_URL,
  API_BASE_URL,
  FRONTEND_ORIGIN,
  CORS_ORIGINS: process.env.CORS_ORIGINS || '',

  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  UPLOAD_DIR,

  DB_SOCKET_PATH,
  DB_HOST,
  DB_PORT: num(process.env.DB_PORT, 3306),
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'by_excellence',
  DB_CONNECTION_LIMIT: num(process.env.DB_CONNECTION_LIMIT, 10),

  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: num(process.env.SMTP_PORT, 587),
  SMTP_SECURE: bool(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '',
  /** Inbox for contact form (defaults to SMTP_USER if unset) */
  CONTACT_INBOX_EMAIL: (process.env.CONTACT_INBOX_EMAIL || '').trim(),

  COMMISSION_STANDARD_PERCENT: num(process.env.COMMISSION_STANDARD_PERCENT, 15),
  COMMISSION_PREMIUM_DEFAULT_PERCENT: num(process.env.COMMISSION_PREMIUM_DEFAULT_PERCENT, 20),

  /** persistent uploads: `s3` (S3-compatible) or `local` (dev only; uses UPLOAD_DIR + /uploads URL) */
  UPLOAD_DRIVER: (process.env.UPLOAD_DRIVER || 'local').toLowerCase(),
  UPLOAD_BUCKET: process.env.UPLOAD_BUCKET || '',
  UPLOAD_REGION: process.env.UPLOAD_REGION || 'us-east-1',
  UPLOAD_ENDPOINT: process.env.UPLOAD_ENDPOINT || '',
  UPLOAD_ACCESS_KEY: process.env.UPLOAD_ACCESS_KEY || '',
  UPLOAD_SECRET_KEY: process.env.UPLOAD_SECRET_KEY || '',
  /** Public base URL for objects (bucket website, CDN, or virtual host). Required for `s3` in production. */
  UPLOAD_PUBLIC_BASE_URL: (process.env.UPLOAD_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  UPLOAD_KEY_PREFIX: process.env.UPLOAD_KEY_PREFIX || 'by-excellence',
  MAX_UPLOAD_MB: num(process.env.MAX_UPLOAD_MB, 10),
  UPLOAD_RATE_LIMIT_WINDOW_MS: num(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  UPLOAD_RATE_LIMIT_MAX: num(process.env.UPLOAD_RATE_LIMIT_MAX, 60),

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
};
