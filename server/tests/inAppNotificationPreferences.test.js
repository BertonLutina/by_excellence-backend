const test = require('node:test');
const assert = require('node:assert/strict');
const {
  IN_APP_PREF_KEYS,
  DEFAULT_IN_APP_PREFS,
  getInAppPrefs,
  wantsInApp,
  mergeInAppPrefs,
} = require('../utils/inAppNotificationPreferences');

test('defaults: all known in-app keys true', () => {
  assert.ok(IN_APP_PREF_KEYS.includes('new_message'));
  assert.ok(IN_APP_PREF_KEYS.includes('status_update'));
  assert.ok(IN_APP_PREF_KEYS.includes('partnership_invite'));
  for (const k of IN_APP_PREF_KEYS) {
    assert.equal(DEFAULT_IN_APP_PREFS[k], true);
  }
});

test('getInAppPrefs: null means all on', () => {
  const p = getInAppPrefs(null);
  assert.equal(p.new_message, true);
  assert.equal(p.offer_status, true);
});

test('getInAppPrefs: respects explicit false', () => {
  const p = getInAppPrefs({ new_message: false });
  assert.equal(p.new_message, false);
  assert.equal(p.status_update, true);
});

test('wantsInApp: false only when explicitly false', () => {
  assert.equal(wantsInApp(null, 'new_message'), true);
  assert.equal(wantsInApp({ in_app_notifications: { new_message: false } }, 'new_message'), false);
  assert.equal(wantsInApp({ status_update: false }, 'status_update'), false);
  assert.equal(wantsInApp({}, 'unknown_type'), true);
});

test('mergeInAppPrefs: ignores unknown keys and coerces booleans', () => {
  const merged = mergeInAppPrefs({ new_message: true }, {
    new_message: false,
    'not.a.key': false,
    offer_status: 0,
  });
  assert.equal(merged.new_message, false);
  assert.equal(merged['not.a.key'], undefined);
  assert.equal(merged.offer_status, false);
});
