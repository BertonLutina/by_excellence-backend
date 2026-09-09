const test = require('node:test');
const assert = require('node:assert/strict');
const { isOriginAllowed, parseCorsOrigins } = require('../utils/corsPolicy');

test('parseCorsOrigins trims comma-separated origins and removes blanks', () => {
  assert.deepEqual(
    parseCorsOrigins(' https://a.example.com, ,https://b.example.com '),
    ['https://a.example.com', 'https://b.example.com']
  );
});

test('production CORS rejects localhost unless explicitly enabled', () => {
  assert.equal(
    isOriginAllowed('http://localhost:5173', {
      frontendOrigin: 'https://byexcellence-as.com',
      corsOrigins: '',
      isProd: true,
      allowLocalDevCors: false,
    }),
    false
  );
});

test('production CORS accepts explicit frontend and extra origins', () => {
  const config = {
    frontendOrigin: 'https://byexcellence-as.com',
    corsOrigins: 'https://www.byexcellence-as.com,https://admin.byexcellence-as.com',
    isProd: true,
    allowLocalDevCors: false,
  };

  assert.equal(isOriginAllowed('https://byexcellence-as.com', config), true);
  assert.equal(isOriginAllowed('https://admin.byexcellence-as.com', config), true);
  assert.equal(isOriginAllowed('https://evil.example.com', config), false);
});

test('development CORS accepts localhost for local testing', () => {
  assert.equal(
    isOriginAllowed('http://127.0.0.1:5173', {
      frontendOrigin: 'https://byexcellence-as.com',
      corsOrigins: '',
      isProd: false,
      allowLocalDevCors: false,
    }),
    true
  );
});
