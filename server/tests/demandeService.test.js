const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../services/demandeService');

function makeMockTxDb(executeImpl) {
  const calls = [];
  const conn = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, params = []) {
      calls.push({ sql, params });
      return executeImpl(sql, params);
    },
  };
  return {
    calls,
    async getConnection() {
      return conn;
    },
    async execute(sql, params = []) {
      calls.push({ sql, params });
      return executeImpl(sql, params);
    },
  };
}

test('single create valid/invalid provider count', async () => {
  assert.throws(() => service.__private.validateProviderIds('single', [1, 2]), /exactly 1 provider/);
  assert.deepEqual(service.__private.validateProviderIds('single', [2]), [2]);
});

test('combo create min/max bounds', async () => {
  assert.throws(() => service.__private.validateProviderIds('combo', []), /between 1 and 5/);
  assert.throws(() => service.__private.validateProviderIds('combo', [1, 2, 3, 4, 5, 6]), /between 1 and 5/);
  assert.deepEqual(service.__private.validateProviderIds('combo', [1, 2, 3]), [1, 2, 3]);
});

test('aggregate status transitions', () => {
  assert.equal(service.__private.resolveAggregateStatus([{ status: 'rejected', is_visible: 1 }]), 'rejected');
  assert.equal(
    service.__private.resolveAggregateStatus([{ status: 'accepted', is_visible: 1 }, { status: 'pending', is_visible: 1 }]),
    'accepted'
  );
  assert.equal(service.__private.resolveAggregateStatus([{ status: 'sent', is_visible: 1 }]), 'sent');
});

test('provider response updates own pivot row only', async () => {
  const db = makeMockTxDb(async (sql, params) => {
    if (sql.startsWith('SELECT id FROM providers WHERE user_id')) return [[{ id: 9 }], []];
    if (sql.startsWith('SELECT * FROM demande_providers WHERE demande_id')) {
      return [[{ demande_id: 11, provider_id: 9, is_visible: 1 }], []];
    }
    if (sql.startsWith('SELECT dp.*, p.user_id')) {
      return [[{ provider_id: 9, status: 'accepted', is_visible: 1, user_id: 22 }], []];
    }
    if (sql.startsWith('SELECT * FROM demandes WHERE id = ?')) return [[{ id: 11, client_id: 55, status: 'sent' }], []];
    if (sql.startsWith('INSERT INTO notifications')) return [{ insertId: 1 }, []];
    return [{ affectedRows: 1, insertId: 11 }, []];
  });

  const result = await service.providerRespond(11, { response: 'accepted' }, { id: 77, role: 'provider' }, db);
  const updateCall = db.calls.find((c) => c.sql.startsWith('UPDATE demande_providers SET status'));

  assert.ok(updateCall);
  assert.equal(updateCall.params[1], 11);
  assert.equal(updateCall.params[2], 9);
  assert.equal(result.provider_id, 9);
});

test('create demande sets pending and links providers', async () => {
  const db = makeMockTxDb(async (sql) => {
    if (sql.startsWith('SELECT id FROM providers WHERE id IN')) return [[{ id: 2 }], []];
    if (sql.startsWith('INSERT INTO demandes')) return [{ insertId: 101 }, []];
    if (sql.startsWith('SELECT dp.*, p.user_id')) return [[{ demande_id: 101, provider_id: 2, user_id: 44, is_visible: 1 }], []];
    if (sql.startsWith('SELECT * FROM demandes WHERE id = ?')) return [[{ id: 101, status: 'pending', client_id: 5 }], []];
    if (sql.startsWith('INSERT INTO notifications')) return [{ insertId: 1 }, []];
    return [{ affectedRows: 1 }, []];
  });

  const out = await service.createDemande(
    { type: 'single', content: 'this is a valid demande content', provider_ids: [2] },
    { id: 5, role: 'client' },
    db
  );

  assert.equal(out.demande.status, 'pending');
  assert.equal(out.providers.length, 1);
});
