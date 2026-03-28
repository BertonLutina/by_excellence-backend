const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const {
  UPLOAD_RATE_LIMIT_WINDOW_MS,
  UPLOAD_RATE_LIMIT_MAX,
} = require('../../constants/constant');

module.exports = rateLimit({
  windowMs: UPLOAD_RATE_LIMIT_WINDOW_MS,
  max: UPLOAD_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user && req.user.id != null) return `upload:uid:${req.user.id}`;
    const ip = req.ip || '127.0.0.1';
    return `upload:ip:${ipKeyGenerator(ip)}`;
  },
  message: { error: 'Too many upload requests' },
  statusCode: 429,
});
