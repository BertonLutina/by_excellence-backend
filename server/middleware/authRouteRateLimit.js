const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const {
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX,
} = require('../../constants/constant');

/**
 * Limits brute-force on login, register, password reset, etc. (per IP).
 */
module.exports = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
  statusCode: 429,
  keyGenerator: (req) => `auth:${ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1')}`,
});
