const test = require('node:test');
const assert = require('node:assert/strict');

const {
  detailUrlForRole,
  resolveUserRole,
} = require('../services/notificationService');

test('resolveUserRole: maps numeric role_id and strings', () => {
  assert.equal(resolveUserRole(2), 'provider');
  assert.equal(resolveUserRole({ role: 2 }), 'provider');
  assert.equal(resolveUserRole({ role: 'provider' }), 'provider');
  assert.equal(resolveUserRole(1), 'client');
  assert.equal(resolveUserRole(3), 'admin');
  assert.equal(resolveUserRole(null), 'client');
});

test('detailUrlForRole: lowercase paths and chat query for messages', () => {
  const provider = detailUrlForRole(2, 42, 7, { chat: true });
  assert.match(provider, /\/providerdashboard\?request=42&offer=7&chat=1$/);

  const client = detailUrlForRole('client', 42, null, { chat: true });
  assert.match(client, /\/clientrequestdetail\?id=42&chat=1$/);

  const admin = detailUrlForRole({ role: 3 }, 9);
  assert.match(admin, /\/adminrequestdetail\?id=9$/);
  assert.doesNotMatch(admin, /chat=1/);
});
