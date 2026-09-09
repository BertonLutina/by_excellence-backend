const test = require('node:test');
const assert = require('node:assert/strict');
const { validateJwtSecret } = require('../utils/secretPolicy');

test('validateJwtSecret requires a JWT secret', () => {
  const result = validateJwtSecret('', { isProd: false });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'missing');
});

test('validateJwtSecret allows short secrets in development only', () => {
  assert.equal(validateJwtSecret('short-dev-secret', { isProd: false }).ok, true);
});

test('validateJwtSecret rejects short production secrets', () => {
  const result = validateJwtSecret('short-dev-secret', { isProd: true });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'too_short');
});

test('validateJwtSecret accepts strong production secrets', () => {
  const strong = 'f496420d901d4132b546b9fd96cf1c4ea75e89f2a323491c';
  assert.equal(validateJwtSecret(strong, { isProd: true }).ok, true);
});
