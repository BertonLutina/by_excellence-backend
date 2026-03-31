const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeProviderTier,
  isValidProviderTier,
} = require('../utils/providerTier');

test('tier mapping for <=1000 vs >1000', () => {
  assert.equal(computeProviderTier(999.99), 'standard');
  assert.equal(computeProviderTier(1000), 'standard');
  assert.equal(computeProviderTier(1000.01), 'premium');
});

test('tier mapping returns null for invalid price values', () => {
  assert.equal(computeProviderTier(null), null);
  assert.equal(computeProviderTier(undefined), null);
  assert.equal(computeProviderTier('not-a-number'), null);
});

test('valid provider tier values are standard and premium', () => {
  assert.equal(isValidProviderTier('standard'), true);
  assert.equal(isValidProviderTier('premium'), true);
  assert.equal(isValidProviderTier('gold'), false);
});
