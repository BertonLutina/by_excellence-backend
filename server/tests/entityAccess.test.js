const test = require('node:test');
const assert = require('node:assert');
const { isAdmin, pickFields } = require('../utils/entityAccess');

test('isAdmin: only the admin role passes', () => {
  assert.equal(isAdmin({ role: 'admin' }), true);
  assert.equal(isAdmin({ role: 'client' }), false);
  assert.equal(isAdmin({ role: 'provider' }), false);
  assert.equal(isAdmin(null), false);
  assert.equal(isAdmin(undefined), false);
  assert.equal(isAdmin({}), false);
});

test('pickFields: keeps allowed keys, reports rejected ones', () => {
  const [ok, rejected] = pickFields(
    { status: 'accepted', total_amount: 1, provider_id: 99 },
    ['status', 'installment_requested']
  );
  assert.deepEqual(ok, { status: 'accepted' });
  assert.deepEqual(rejected.sort(), ['provider_id', 'total_amount']);
});

test('pickFields: empty/absent body is safe', () => {
  assert.deepEqual(pickFields(null, ['a']), [{}, []]);
  assert.deepEqual(pickFields({}, ['a']), [{}, []]);
});

test('pickFields: does not let prototype keys sneak in', () => {
  const [ok, rejected] = pickFields({ __proto__: { hacked: true }, status: 'rejected' }, ['status']);
  assert.deepEqual(ok, { status: 'rejected' });
  assert.equal(rejected.length, 0);
  assert.equal(ok.hacked, undefined);
});
