const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../db/db');
let sqlHandler = () => [];
db.executeSQL = async (sql, params = []) => sqlHandler(String(sql), params);

const controller = require('../controllers/serviceItemController');
const ServiceItem = require('../models/ServiceItem');

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

function providerForUser(providerId) {
  sqlHandler = (_sql, params = []) => (Number(params[0]) === 5 ? [{ id: providerId }] : []);
}

test('provider-created service items use the caller provider profile and preserve good item type', async () => {
  const originalCreate = ServiceItem.create;
  let capturedPayload = null;
  providerForUser(22);
  ServiceItem.create = async (payload) => {
    capturedPayload = payload;
    return { id: 7, ...payload };
  };

  const req = {
    user: { id: 5, role: 'provider' },
    body: { provider_id: 999, item_type: 'good', title: 'Caisse de jus', price: '24.50' },
  };
  const res = createMockRes();

  try {
    await controller.create(req, res);
  } finally {
    sqlHandler = () => [];
    ServiceItem.create = originalCreate;
  }

  assert.equal(res.statusCode, 201);
  assert.equal(capturedPayload.provider_id, 22);
  assert.equal(capturedPayload.item_type, 'good');
});

test('provider-created goods normalize stock, minimum order quantity and unit', async () => {
  const originalCreate = ServiceItem.create;
  let capturedPayload = null;
  providerForUser(22);
  ServiceItem.create = async (payload) => {
    capturedPayload = payload;
    return { id: 8, ...payload };
  };

  const req = {
    user: { id: 5, role: 'provider' },
    body: {
      item_type: 'good',
      title: 'Pack ceremonie',
      stock_quantity: '12pieces',
      min_order_quantity: '-3',
      unit: `  ${'c'.repeat(55)}  `,
    },
  };
  const res = createMockRes();

  try {
    await controller.create(req, res);
  } finally {
    sqlHandler = () => [];
    ServiceItem.create = originalCreate;
  }

  assert.equal(res.statusCode, 201);
  assert.equal(capturedPayload.stock_quantity, 12);
  assert.equal(capturedPayload.min_order_quantity, null);
  assert.equal(capturedPayload.unit, 'c'.repeat(50));
});

test('client cannot create a good service item', async () => {
  const originalCreate = ServiceItem.create;
  let createCalled = false;
  ServiceItem.create = async () => {
    createCalled = true;
    return { id: 9 };
  };

  const req = {
    user: { id: 6, role: 'client' },
    body: { item_type: 'good', title: 'Caisse de jus' },
  };
  const res = createMockRes();

  try {
    await controller.create(req, res);
  } finally {
    ServiceItem.create = originalCreate;
  }

  assert.equal(res.statusCode, 403);
  assert.equal(createCalled, false);
});

test('provider cannot update another provider service item', async () => {
  const originalFindById = ServiceItem.findById;
  const originalUpdate = ServiceItem.update;
  let updateCalled = false;
  providerForUser(22);
  ServiceItem.findById = async () => ({ id: 7, provider_id: 99, item_type: 'good' });
  ServiceItem.update = async () => {
    updateCalled = true;
    return { id: 7 };
  };

  const req = { user: { id: 5, role: 'provider' }, params: { id: 7 }, body: { title: 'Updated' } };
  const res = createMockRes();

  try {
    await controller.update(req, res);
  } finally {
    sqlHandler = () => [];
    ServiceItem.findById = originalFindById;
    ServiceItem.update = originalUpdate;
  }

  assert.equal(res.statusCode, 403);
  assert.equal(updateCalled, false);
});

test('provider cannot delete another provider service item', async () => {
  const originalFindById = ServiceItem.findById;
  const originalDelete = ServiceItem.delete;
  let deleteCalled = false;
  providerForUser(22);
  ServiceItem.findById = async () => ({ id: 7, provider_id: 99, item_type: 'good' });
  ServiceItem.delete = async () => {
    deleteCalled = true;
    return { id: 7 };
  };

  const req = { user: { id: 5, role: 'provider' }, params: { id: 7 } };
  const res = createMockRes();

  try {
    await controller.remove(req, res);
  } finally {
    sqlHandler = () => [];
    ServiceItem.findById = originalFindById;
    ServiceItem.delete = originalDelete;
  }

  assert.equal(res.statusCode, 403);
  assert.equal(deleteCalled, false);
});
