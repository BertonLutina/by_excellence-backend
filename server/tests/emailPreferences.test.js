const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EMAIL_PREF_KEYS,
  DEFAULT_EMAIL_PREFS,
  getEmailPrefs,
  wantsEmail,
  mergeEmailPrefs,
} = require('../utils/emailPreferences');

test('defaults: all known keys true', () => {
  assert.ok(EMAIL_PREF_KEYS.includes('status.cancelled'));
  assert.ok(EMAIL_PREF_KEYS.includes('collaboration.invite'));
  for (const k of EMAIL_PREF_KEYS) {
    assert.equal(DEFAULT_EMAIL_PREFS[k], true);
  }
});

test('getEmailPrefs: null means all on', () => {
  const p = getEmailPrefs(null);
  assert.equal(p['status.cancelled'], true);
  assert.equal(p['payments.confirmation'], true);
});

test('getEmailPrefs: respects explicit false', () => {
  const p = getEmailPrefs({ 'status.cancelled': false });
  assert.equal(p['status.cancelled'], false);
  assert.equal(p['status.completed'], true);
});

test('getEmailPrefs: parses JSON string', () => {
  const p = getEmailPrefs(JSON.stringify({ 'offer.accepted': false }));
  assert.equal(p['offer.accepted'], false);
});

test('wantsEmail: false only when explicitly false', () => {
  assert.equal(wantsEmail(null, 'status.request_sent'), true);
  assert.equal(wantsEmail({ email_notifications: { 'status.request_sent': false } }, 'status.request_sent'), false);
  assert.equal(wantsEmail({ 'payments.confirmation': false }, 'payments.confirmation'), false);
});

test('mergeEmailPrefs: ignores unknown keys and coerces booleans', () => {
  const merged = mergeEmailPrefs({ 'status.cancelled': true }, {
    'status.cancelled': false,
    'not.a.key': false,
    'payments.confirmation': 0,
  });
  assert.equal(merged['status.cancelled'], false);
  assert.equal(merged['not.a.key'], undefined);
  assert.equal(merged['payments.confirmation'], false);
});
