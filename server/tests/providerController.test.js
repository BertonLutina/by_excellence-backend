const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/providerController');
const Provider = require('../models/Provider');

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('invalid tier query returns 400', async () => {
  const req = { query: { tier: 'gold' } };
  const res = createMockRes();

  await controller.getAll(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Invalid tier/i);
});

test('filtering providers by tier works', async () => {
  const originalFindAll = Provider.findAll;
  const calls = [];
  Provider.findAll = async (opts) => {
    calls.push(opts);
    return [{ id: 1, provider_tier: 'premium' }];
  };

  const req = { query: { tier: 'premium', limit: '10', sort: '-created_at' } };
  const res = createMockRes();

  await controller.getAll(req, res);

  Provider.findAll = originalFindAll;

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.body), true);
  assert.equal(res.body[0].provider_tier, 'premium');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].filters.provider_tier, 'premium');
});

test('include_total returns items and total and passes offset', async () => {
  const originalFindAll = Provider.findAll;
  const originalCountAll = Provider.countAll;
  Provider.findAll = async (opts) => {
    assert.equal(opts.offset, 16);
    assert.equal(opts.limit, 8);
    return [{ id: 2 }];
  };
  Provider.countAll = async (opts) => {
    assert.equal(opts.filters.status, 'active');
    return 42;
  };

  const req = { query: { status: 'active', limit: '8', offset: '16', include_total: '1', sort: '-rating' } };
  const res = createMockRes();

  await controller.getAll(req, res);

  Provider.findAll = originalFindAll;
  Provider.countAll = originalCountAll;

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.body.items), true);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.total, 42);
});

test('create provider sets correct tier from price_from', async () => {
  const originalCreate = Provider.create;
  let capturedPayload = null;
  Provider.create = async (payload) => {
    capturedPayload = payload;
    return { id: 2, ...payload };
  };

  const req = { body: { display_name: 'P1', price_from: 500 } };
  const res = createMockRes();

  await controller.create(req, res);

  Provider.create = originalCreate;

  assert.equal(res.statusCode, 201);
  assert.equal(capturedPayload.provider_tier, 'standard');
  assert.equal(res.body.provider_tier, 'standard');
  assert.equal(capturedPayload.structure_type, 'solo');
  assert.equal(capturedPayload.worker_count, 1);
});

test('create provider normalizes provider activity proposal fields', async () => {
  const originalCreate = Provider.create;
  let capturedPayload = null;
  Provider.create = async (payload) => {
    capturedPayload = payload;
    return { id: 3, ...payload };
  };

  const req = {
    body: {
      display_name: 'P2',
      activity_type: 'goods',
      suggested_category_name: `  ${'A'.repeat(160)}  `,
      suggested_category_type: 'unknown',
    },
  };
  const res = createMockRes();

  try {
    await controller.create(req, res);
  } finally {
    Provider.create = originalCreate;
  }

  assert.equal(res.statusCode, 201);
  assert.equal(capturedPayload.activity_type, 'goods');
  assert.equal(capturedPayload.suggested_category_name, 'A'.repeat(150));
  assert.equal(capturedPayload.suggested_category_type, 'service');
});

test('update price_from updates tier', async () => {
  const originalUpdate = Provider.update;
  const originalFindById = Provider.findById;
  let capturedUpdatePayload = null;
  Provider.findById = async () => ({
    id: 10,
    user_id: 7,
    price_from: 500,
    structure_type: 'solo',
    worker_count: 1,
  });
  Provider.update = async (id, payload) => {
    capturedUpdatePayload = payload;
    return { id, ...payload };
  };

  const req = { params: { id: 10 }, body: { price_from: 1500 }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await controller.update(req, res);

  Provider.update = originalUpdate;
  Provider.findById = originalFindById;

  assert.equal(res.statusCode, 200);
  assert.equal(capturedUpdatePayload.provider_tier, 'premium');
  assert.equal(res.body.provider_tier, 'premium');
});

test('update provider coerces unknown activity type to service', async () => {
  const originalUpdate = Provider.update;
  const originalFindById = Provider.findById;
  let capturedUpdatePayload = null;
  Provider.findById = async () => ({
    id: 10,
    user_id: 5,
    structure_type: 'solo',
    worker_count: 1,
  });
  Provider.update = async (id, payload) => {
    capturedUpdatePayload = payload;
    return { id, ...payload };
  };

  const req = {
    user: { id: 5, role: 'provider' },
    params: { id: 10 },
    body: {
      activity_type: 'retail',
      suggested_category_type: 'both',
      suggested_category_name: ' Accessoires ',
    },
  };
  const res = createMockRes();

  try {
    await controller.update(req, res);
  } finally {
    Provider.update = originalUpdate;
    Provider.findById = originalFindById;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(capturedUpdatePayload.activity_type, 'service');
  assert.equal(capturedUpdatePayload.suggested_category_type, 'both');
  assert.equal(capturedUpdatePayload.suggested_category_name, 'Accessoires');
});

test('provider update rejects non-owner provider users', async () => {
  const originalUpdate = Provider.update;
  const originalFindById = Provider.findById;
  let updateCalled = false;
  Provider.findById = async () => ({
    id: 10,
    user_id: 99,
    structure_type: 'solo',
    worker_count: 1,
  });
  Provider.update = async () => {
    updateCalled = true;
    return { id: 10 };
  };

  const req = { user: { id: 5, role: 'provider' }, params: { id: 10 }, body: { display_name: 'Nope' } };
  const res = createMockRes();

  try {
    await controller.update(req, res);
  } finally {
    Provider.update = originalUpdate;
    Provider.findById = originalFindById;
  }

  assert.equal(res.statusCode, 403);
  assert.equal(updateCalled, false);
});

test('provider delete rejects non-owner provider users', async () => {
  const originalDelete = Provider.delete;
  const originalFindById = Provider.findById;
  let deleteCalled = false;
  Provider.findById = async () => ({
    id: 10,
    user_id: 99,
  });
  Provider.delete = async () => {
    deleteCalled = true;
    return { id: 10 };
  };

  const req = { user: { id: 5, role: 'provider' }, params: { id: 10 } };
  const res = createMockRes();

  try {
    await controller.remove(req, res);
  } finally {
    Provider.delete = originalDelete;
    Provider.findById = originalFindById;
  }

  assert.equal(res.statusCode, 403);
  assert.equal(deleteCalled, false);
});

test('invalid provider_tier in body returns 400', async () => {
  const req = { body: { price_from: 1500, provider_tier: 'vip' } };
  const res = createMockRes();

  await controller.create(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Invalid provider_tier/i);
});

test('update rejects a non-owner, non-admin caller (IDOR guard)', async () => {
  const originalFindById = Provider.findById;
  const originalUpdate = Provider.update;
  let updateCalled = false;
  Provider.findById = async () => ({ id: 10, user_id: 7 });
  Provider.update = async () => { updateCalled = true; };

  const req = { params: { id: 10 }, body: { bio: 'hacked' }, user: { id: 999, role: 'provider' } };
  const res = createMockRes();

  await controller.update(req, res);

  Provider.findById = originalFindById;
  Provider.update = originalUpdate;

  assert.equal(res.statusCode, 403);
  assert.equal(updateCalled, false);
});

test('update allows an admin to edit any provider', async () => {
  const originalFindById = Provider.findById;
  const originalUpdate = Provider.update;
  Provider.findById = async () => ({ id: 10, user_id: 7 });
  Provider.update = async (id, payload) => ({ id, ...payload });

  const req = { params: { id: 10 }, body: { bio: 'edited by admin' }, user: { id: 1, role: 'admin' } };
  const res = createMockRes();

  await controller.update(req, res);

  Provider.findById = originalFindById;
  Provider.update = originalUpdate;

  assert.equal(res.statusCode, 200);
});

test('update strips stripe connect fields from the request body (mass-assignment guard)', async () => {
  const originalFindById = Provider.findById;
  const originalUpdate = Provider.update;
  let capturedPayload = null;
  Provider.findById = async () => ({ id: 10, user_id: 7 });
  Provider.update = async (id, payload) => {
    capturedPayload = payload;
    return { id, ...payload };
  };

  const req = {
    params: { id: 10 },
    body: { bio: 'hi', stripe_account_id: 'acct_attacker', stripe_payouts_enabled: 1 },
    user: { id: 7, role: 'provider' },
  };
  const res = createMockRes();

  await controller.update(req, res);

  Provider.findById = originalFindById;
  Provider.update = originalUpdate;

  assert.equal(res.statusCode, 200);
  assert.equal('stripe_account_id' in capturedPayload, false);
  assert.equal('stripe_payouts_enabled' in capturedPayload, false);
});

test('create rejects setting user_id to someone else when not admin', async () => {
  const req = { body: { display_name: 'P1', user_id: 999 }, user: { id: 1, role: 'provider' } };
  const res = createMockRes();

  await controller.create(req, res);

  assert.equal(res.statusCode, 403);
});

test('create forces user_id to the caller for non-admins', async () => {
  const originalCreate = Provider.create;
  let capturedPayload = null;
  Provider.create = async (payload) => {
    capturedPayload = payload;
    return { id: 2, ...payload };
  };

  const req = { body: { display_name: 'P1' }, user: { id: 42, role: 'provider' } };
  const res = createMockRes();

  await controller.create(req, res);

  Provider.create = originalCreate;

  assert.equal(res.statusCode, 201);
  assert.equal(capturedPayload.user_id, 42);
});
