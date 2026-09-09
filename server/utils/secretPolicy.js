const MIN_PRODUCTION_JWT_SECRET_LENGTH = 32;

function validateJwtSecret(secret, { isProd } = {}) {
  const value = typeof secret === 'string' ? secret.trim() : '';
  if (!value) {
    return { ok: false, reason: 'missing' };
  }
  if (isProd && value.length < MIN_PRODUCTION_JWT_SECRET_LENGTH) {
    return {
      ok: false,
      reason: 'too_short',
      minLength: MIN_PRODUCTION_JWT_SECRET_LENGTH,
    };
  }
  return { ok: true };
}

module.exports = {
  MIN_PRODUCTION_JWT_SECRET_LENGTH,
  validateJwtSecret,
};
