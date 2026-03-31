const test = require('node:test');
const assert = require('node:assert/strict');
const {
  coercePortfolioImages,
  PortfolioImagesParseError,
} = require('../utils/portfolioImages');
const Provider = require('../models/Provider');

test('coerce parses JSON string to value', () => {
  assert.deepEqual(coercePortfolioImages('["a","b"]'), ['a', 'b']);
  assert.deepEqual(coercePortfolioImages('{}'), {});
});

test('coerce leaves arrays and objects unchanged', () => {
  const arr = ['/x.png'];
  assert.strictEqual(coercePortfolioImages(arr), arr);
  assert.deepEqual(coercePortfolioImages({ urls: ['x'] }), { urls: ['x'] });
});

test('coerce null and empty string to null', () => {
  assert.strictEqual(coercePortfolioImages(null), null);
  assert.strictEqual(coercePortfolioImages(''), null);
});

test('invalid JSON string throws', () => {
  assert.throws(() => coercePortfolioImages('not-json'), PortfolioImagesParseError);
});

test('Provider maps portfolio_images to JSON text for SQL binding', () => {
  const p = new Provider({
    portfolio_images: '["https://cdn.example/a.jpg","https://cdn.example/b.jpg"]',
  });
  assert.deepEqual(JSON.parse(p.portfolio_images), [
    'https://cdn.example/a.jpg',
    'https://cdn.example/b.jpg',
  ]);
});
