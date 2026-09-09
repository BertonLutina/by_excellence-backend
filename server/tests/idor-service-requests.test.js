'use strict';

/**
 * Non-régression IDOR — /service-requests (correctif BEX-005).
 *
 * BEX-005 a ajouté le contrôle de propriété qui manquait sur
 * `serviceRequestController` :
 *   - getOne : `assertCanViewRequest` (admin / client propriétaire / prestataire
 *     assigné ou collaborateur) sinon `isRequestClient` (legacy-safe) ;
 *   - getAll : seul un admin liste sans portée ; un prestataire est forcé sur
 *     son propre pid, un client sur ses propres demandes via
 *     `WHERE client_id = ? OR client_id IN (SELECT id FROM clients WHERE user_id = ?)` ;
 *   - update : admin ou client propriétaire uniquement, et le client est borné
 *     à `status ∈ {offer_accepted, cancelled}` ;
 *   - remove : n'hérite plus du CRUD nu — admin ou client propriétaire.
 *
 * Même harnais que idor-access.test.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// --- interception bas niveau, avant tout require de contrôleur ---------------
const db = require('../db/db');
const sqlCalls = [];
let sqlHandler = () => [];
db.executeSQL = async (sql, params = []) => {
  const norm = String(sql).replace(/\s+/g, ' ').trim();
  sqlCalls.push({ sql: norm, params });
  return sqlHandler(norm, params);
};

const serviceRequestController = require('../controllers/serviceRequestController');
const ServiceRequest = require('../models/ServiceRequest');

// --- helpers (identiques à idor-access.test.js) -----------------------------
function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

function stub(target, overrides) {
  const saved = {};
  for (const k of Object.keys(overrides)) { saved[k] = target[k]; target[k] = overrides[k]; }
  return () => { for (const k of Object.keys(saved)) target[k] = saved[k]; };
}

function withStubs(t, ...pairs) {
  const restores = pairs.map(([obj, ov]) => stub(obj, ov));
  t.after(() => restores.forEach((r) => r()));
}

function routeSql(...routes) {
  sqlHandler = (norm, params) => {
    for (const [needle, val] of routes) {
      if (norm.includes(needle)) return typeof val === 'function' ? val(params, norm) : val;
    }
    return [];
  };
}

test.beforeEach(() => {
  sqlCalls.length = 0;
  sqlHandler = () => [];
});

// isRequestClient(id, userId) : deux requêtes possibles
const requestClientRoutes = ({ requestClientId, clientsIdToUserId = {} }) => [
  ['client_id FROM service_requests WHERE id = ?', () => [{ client_id: requestClientId }]],
  ['user_id FROM clients WHERE id = ?', (p) => (clientsIdToUserId[Number(p[0])] != null ? [{ user_id: clientsIdToUserId[Number(p[0])] }] : [])],
];
const ENRICH_ROUTES = [
  ['email FROM users WHERE id = ?', () => [{ email: 'client@x.com' }]],
  ['FROM service_request_collaborators', () => []],
];

// ===========================================================================
// GET /service-requests/:id
// ===========================================================================

test('service-requests GET /:id : un tiers (client non concerné) → 403', async (t) => {
  routeSql(
    ...requestClientRoutes({ requestClientId: 50 }),
    ...ENRICH_ROUTES,
  );
  withStubs(t, [ServiceRequest, {
    findById: async () => ({ id: 4, client_id: 50, provider_id: 3, service_description: 'mariage' }),
  }]);
  const req = { params: { id: 4 }, user: { id: 99, role: 'client' } };
  const res = createMockRes();

  await serviceRequestController.getOne(req, res);

  assert.equal(res.statusCode, 403);
});

test('service-requests GET /:id : un prestataire non assigné → 403', async (t) => {
  routeSql(
    ['FROM providers WHERE user_id = ?', (p) => (Number(p[0]) === 77 ? [{ id: 5 }] : [])],
    ...requestClientRoutes({ requestClientId: 50 }),
    ...ENRICH_ROUTES,
  );
  withStubs(t, [ServiceRequest, {
    findById: async () => ({ id: 4, client_id: 50, provider_id: 3 }),
  }]);
  const req = { params: { id: 4 }, user: { id: 77, role: 'provider' } };
  const res = createMockRes();

  await serviceRequestController.getOne(req, res);

  assert.equal(res.statusCode, 403);
});

test('service-requests GET /:id : le client propriétaire → 200', async (t) => {
  routeSql(...ENRICH_ROUTES);
  withStubs(t, [ServiceRequest, {
    findById: async () => ({ id: 4, client_id: 50, provider_id: 3 }),
  }]);
  const req = { params: { id: 4 }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await serviceRequestController.getOne(req, res);

  assert.equal(res.statusCode, 200);
});

test('service-requests GET /:id : le prestataire assigné → 200', async (t) => {
  routeSql(
    ['FROM providers WHERE user_id = ?', (p) => (Number(p[0]) === 7 ? [{ id: 3 }] : [])],
    ...ENRICH_ROUTES,
  );
  withStubs(t, [ServiceRequest, {
    findById: async () => ({ id: 4, client_id: 50, provider_id: 3 }),
  }]);
  const req = { params: { id: 4 }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await serviceRequestController.getOne(req, res);

  assert.equal(res.statusCode, 200);
});

// --- non-régression legacy : service_requests.client_id = clients.id --------
test('service-requests (legacy) GET /:id : client_id pointe sur clients.id → le client propriétaire accède quand même', async (t) => {
  routeSql(
    ...requestClientRoutes({ requestClientId: 12, clientsIdToUserId: { 12: 50 } }),
    ...ENRICH_ROUTES,
  );
  withStubs(t, [ServiceRequest, {
    findById: async () => ({ id: 4, client_id: 12, provider_id: 3 }),
  }]);
  const req = { params: { id: 4 }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await serviceRequestController.getOne(req, res);

  assert.equal(res.statusCode, 200);
});

// ===========================================================================
// GET /service-requests (liste)
// ===========================================================================

test('service-requests GET liste : un client ne voit que ses demandes, ?client_id=<autre> ignoré', async (t) => {
  let findAllCalled = false;
  routeSql(
    ['FROM service_requests WHERE client_id = ?', () => [{ id: 4, client_id: 50 }]],
    ...ENRICH_ROUTES,
  );
  withStubs(t, [ServiceRequest, { findAll: async () => { findAllCalled = true; return [{ id: 999, client_id: 777 }]; } }]);
  const req = { query: { client_id: '999' }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await serviceRequestController.getAll(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(findAllCalled, false, 'le chemin client n’utilise pas le CRUD générique filtrable');
  const scoped = sqlCalls.find((c) => c.sql.includes('FROM service_requests WHERE client_id = ?'));
  assert.ok(scoped, 'la liste client est une requête scellée sur l’appelant');
  assert.deepEqual(scoped.params.map(String), ['50', '50'], 'seul l’id de l’appelant est lié, jamais 999');
  assert.ok(scoped.sql.includes('IN (SELECT id FROM clients WHERE user_id = ?)'), 'match legacy-safe');
});

test('service-requests GET liste : un prestataire est forcé sur son pid, ?provider_id=<autre> ignoré', async (t) => {
  routeSql(
    ['FROM providers WHERE user_id = ?', (p) => (Number(p[0]) === 7 ? [{ id: 3 }] : [])],
    ['FROM service_requests sr', () => []],
  );
  withStubs(t, [ServiceRequest, { findAll: async () => { throw new Error('findAll ne doit pas être appelé pour un prestataire'); } }]);
  const req = { query: { provider_id: '99' }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await serviceRequestController.getAll(req, res);

  assert.equal(res.statusCode, 200);
  const spoofed = sqlCalls.some((c) => c.params.map(String).includes('99'));
  assert.equal(spoofed, false, 'provider_id=99 (usurpé) ne doit atteindre aucune requête');
  assert.ok(sqlCalls.some((c) => c.params.map(String).includes('3')), 'la portée est le pid réel du prestataire');
});

test('service-requests GET liste : un prestataire sans profil provider → liste vide', async () => {
  routeSql(['FROM providers WHERE user_id = ?', () => []]);
  const req = { query: {}, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await serviceRequestController.getAll(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, []);
});

test('service-requests GET liste : un admin garde la liste filtrable (comportement CRUD)', async (t) => {
  let opts = null;
  routeSql(...ENRICH_ROUTES);
  withStubs(t, [ServiceRequest, { findAll: async (o) => { opts = o; return []; } }]);
  const req = { query: { client_id: '999' }, user: { id: 1, role: 'admin' } };
  const res = createMockRes();

  await serviceRequestController.getAll(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(opts.filters.client_id, '999', 'un admin peut filtrer librement');
});

// ===========================================================================
// PUT / DELETE /service-requests/:id
// ===========================================================================

test('service-requests PUT /:id : un tiers → 403', async (t) => {
  let updateCalled = false;
  routeSql(...requestClientRoutes({ requestClientId: 50 }));
  withStubs(t, [ServiceRequest, {
    findById: async () => ({ id: 4, client_id: 50, status: 'offer_sent' }),
    update: async () => { updateCalled = true; return { id: 4 }; },
  }]);
  const req = { params: { id: 4 }, body: { status: 'cancelled' }, user: { id: 99, role: 'client' } };
  const res = createMockRes();

  await serviceRequestController.update(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(updateCalled, false);
});

test('service-requests PUT /:id : le client propriétaire peut annuler → 200', async (t) => {
  const updateArgs = [];
  routeSql(...requestClientRoutes({ requestClientId: 50 }));
  withStubs(t, [ServiceRequest, {
    findById: async () => ({ id: 4, client_id: 50, status: 'offer_sent' }),
    update: async (id, body) => { updateArgs.push({ id, body }); return { id: 4, status: 'cancelled' }; },
  }]);
  const req = { params: { id: 4 }, body: { status: 'cancelled' }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await serviceRequestController.update(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(updateArgs[0].body, { status: 'cancelled' });
});

test('service-requests PUT /:id : le client propriétaire ne peut pas toucher au budget → 403', async (t) => {
  let updateCalled = false;
  routeSql(...requestClientRoutes({ requestClientId: 50 }));
  withStubs(t, [ServiceRequest, {
    findById: async () => ({ id: 4, client_id: 50, status: 'offer_sent' }),
    update: async () => { updateCalled = true; return { id: 4 }; },
  }]);
  const req = { params: { id: 4 }, body: { budget: '999999' }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await serviceRequestController.update(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(updateCalled, false);
});

test('service-requests DELETE /:id : un tiers → 403', async (t) => {
  let deleteCalled = false;
  routeSql(...requestClientRoutes({ requestClientId: 50 }));
  withStubs(t, [ServiceRequest, {
    findById: async () => ({ id: 4, client_id: 50 }),
    delete: async () => { deleteCalled = true; },
  }]);
  const req = { params: { id: 4 }, user: { id: 99, role: 'client' } };
  const res = createMockRes();

  await serviceRequestController.remove(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(deleteCalled, false);
});

test('service-requests DELETE /:id : le client propriétaire → 200', async (t) => {
  let deleteCalled = false;
  routeSql(...requestClientRoutes({ requestClientId: 50 }));
  withStubs(t, [ServiceRequest, {
    findById: async () => ({ id: 4, client_id: 50 }),
    delete: async () => { deleteCalled = true; },
  }]);
  const req = { params: { id: 4 }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await serviceRequestController.remove(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(deleteCalled, true);
});

test('service-requests DELETE /:id : un admin → 200', async (t) => {
  let deleteCalled = false;
  withStubs(t, [ServiceRequest, {
    findById: async () => ({ id: 4, client_id: 50 }),
    delete: async () => { deleteCalled = true; },
  }]);
  const req = { params: { id: 4 }, user: { id: 1, role: 'admin' } };
  const res = createMockRes();

  await serviceRequestController.remove(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(deleteCalled, true);
});
