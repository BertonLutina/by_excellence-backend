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
});

test('update price_from updates tier', async () => {
  const originalUpdate = Provider.update;
  let capturedUpdatePayload = null;
  Provider.update = async (id, payload) => {
    capturedUpdatePayload = payload;
    return { id, ...payload };
  };

  const req = { params: { id: 10 }, body: { price_from: 1500 } };
  const res = createMockRes();

  await controller.update(req, res);

  Provider.update = originalUpdate;

  assert.equal(res.statusCode, 200);
  assert.equal(capturedUpdatePayload.provider_tier, 'premium');
  assert.equal(res.body.provider_tier, 'premium');
});

test('invalid provider_tier in body returns 400', async () => {
  const req = { body: { price_from: 1500, provider_tier: 'vip' } };
  const res = createMockRes();

  await controller.create(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Invalid provider_tier/i);
});
