const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/serviceItemController');
const Provider = require('../models/Provider');
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

test('provider-created service items use the caller provider profile and preserve good item type', async () => {
  const originalFindByUserId = Provider.findByUserId;
  const originalCreate = ServiceItem.create;
  let capturedPayload = null;
  Provider.findByUserId = async (userId) => ({ id: 22, user_id: userId });
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
    Provider.findByUserId = originalFindByUserId;
    ServiceItem.create = originalCreate;
  }

  assert.equal(res.statusCode, 201);
  assert.equal(capturedPayload.provider_id, 22);
  assert.equal(capturedPayload.item_type, 'good');
});

test('provider cannot update another provider service item', async () => {
  const originalFindByUserId = Provider.findByUserId;
  const originalFindById = ServiceItem.findById;
  const originalUpdate = ServiceItem.update;
  let updateCalled = false;
  Provider.findByUserId = async () => ({ id: 22, user_id: 5 });
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
    Provider.findByUserId = originalFindByUserId;
    ServiceItem.findById = originalFindById;
    ServiceItem.update = originalUpdate;
  }

  assert.equal(res.statusCode, 403);
  assert.equal(updateCalled, false);
});

test('provider cannot delete another provider service item', async () => {
  const originalFindByUserId = Provider.findByUserId;
  const originalFindById = ServiceItem.findById;
  const originalDelete = ServiceItem.delete;
  let deleteCalled = false;
  Provider.findByUserId = async () => ({ id: 22, user_id: 5 });
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
    Provider.findByUserId = originalFindByUserId;
    ServiceItem.findById = originalFindById;
    ServiceItem.delete = originalDelete;
  }

  assert.equal(res.statusCode, 403);
  assert.equal(deleteCalled, false);
});
