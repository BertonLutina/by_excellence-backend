process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const categoryController = require('../controllers/serviceCategoryController');

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET);
}

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

async function runRoute(router, method, path, { token, body } = {}) {
  const routeLayer = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
  assert.ok(routeLayer, `${method.toUpperCase()} ${path} route exists`);
  const req = {
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body || {},
    params: {},
    query: {},
  };
  const res = createMockRes();
  const handlers = routeLayer.route.stack.map((layer) => layer.handle);
  let idx = 0;
  const next = async () => {
    const handler = handlers[idx];
    idx += 1;
    if (!handler || res.body) return;
    await handler(req, res, next);
  };
  await next();
  return res;
}

test('service category writes require admin while public reads stay public', async () => {
  const originalGetAll = categoryController.getAll;
  const originalCreate = categoryController.create;
  let getCalled = 0;
  let createCalled = 0;
  categoryController.getAll = async (req, res) => {
    getCalled += 1;
    return res.json([{ id: 1, name: 'Boissons' }]);
  };
  categoryController.create = async (req, res) => {
    createCalled += 1;
    return res.status(201).json({ id: 2, ...req.body });
  };

  delete require.cache[require.resolve('../routes/serviceCategories')];
  const router = require('../routes/serviceCategories');

  try {
    const read = await runRoute(router, 'get', '/');
    assert.equal(read.statusCode, 200);
    assert.equal(getCalled, 1);

    const write = await runRoute(router, 'post', '/', {
      token: tokenFor({ id: 10, role: 'provider' }),
      body: { name: 'Boissons', category_type: 'goods' },
    });
    assert.equal(write.statusCode, 403);
    assert.equal(createCalled, 0);
  } finally {
    categoryController.getAll = originalGetAll;
    categoryController.create = originalCreate;
  }
});
