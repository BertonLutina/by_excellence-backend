'use strict';

/**
 * Non-régression IDOR (BEX-004) — chemins d'argent et de droits d'accès.
 *
 * Couvre les neuf failles fermées le 24/08/2026 (campagne P0) qui n'avaient
 * jamais pu être testées : le shell était en panne ce jour-là, les correctifs
 * sont partis en production nus.
 *
 * Convention (identique à providerController.test.js / stripeConnectController.test.js) :
 *   - on appelle le contrôleur directement avec un req/res simulé ;
 *   - `req.user` porte l'identité (id + role) posée par le middleware `authenticate` ;
 *   - les méthodes statiques des modèles sont remplacées le temps d'un test ;
 *   - `db.executeSQL` et `getStripe` sont interceptés AVANT le require des
 *     contrôleurs (entityAccess et plusieurs contrôleurs capturent
 *     `const { executeSQL } = require('../db/db')` au chargement du module).
 *
 * Le domaine `/service-requests` (correctif BEX-005) est dans son propre
 * fichier : idor-service-requests.test.js.
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

const stripeClient = require('../utils/stripeClient');
const stripeCalls = [];
stripeClient.getStripe = () => ({
  products: {
    create: async (a) => { stripeCalls.push(['products.create', a]); return { id: 'prod_test' }; },
    update: async (a, b) => { stripeCalls.push(['products.update', a, b]); return { id: a }; },
  },
  prices: {
    create: async (a) => { stripeCalls.push(['prices.create', a]); return { id: 'price_test' }; },
    update: async (a, b) => { stripeCalls.push(['prices.update', a, b]); return { id: a }; },
    retrieve: async (a) => { stripeCalls.push(['prices.retrieve', a]); return { id: a, unit_amount: 0 }; },
  },
});

// --- contrôleurs sous test --------------------------------------------------
const serviceItemController = require('../controllers/serviceItemController');
const providerController = require('../controllers/providerController');
const platformReviewController = require('../controllers/platformReviewController');
const offerController = require('../controllers/offerController');
const messageController = require('../controllers/messageController');
const favoriteController = require('../controllers/favoriteController');
const userController = require('../controllers/userController');
const bookingController = require('../controllers/bookingController');

// --- modèles (méthodes statiques = points d'injection) ----------------------
const ServiceItem = require('../models/ServiceItem');
const Provider = require('../models/Provider');
const PlatformReview = require('../models/PlatformReview');
const Offer = require('../models/Offer');
const Message = require('../models/Message');
const Favorite = require('../models/Favorite');
const User = require('../models/User');
const Booking = require('../models/Booking');
const ServiceRequest = require('../models/ServiceRequest');

// --- helpers ---------------------------------------------------------------
function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

/** Remplace des méthodes sur `target`, renvoie la fonction de restauration. */
function stub(target, overrides) {
  const saved = {};
  for (const k of Object.keys(overrides)) { saved[k] = target[k]; target[k] = overrides[k]; }
  return () => { for (const k of Object.keys(saved)) target[k] = saved[k]; };
}

/** Enregistre des stubs modèle toujours restaurés en fin de test. */
function withStubs(t, ...pairs) {
  const restores = pairs.map(([obj, ov]) => stub(obj, ov));
  t.after(() => restores.forEach((r) => r()));
}

/** Route le SQL simulé par sous-chaîne. routes: [[substr, rows|fn], ...] */
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
  stripeCalls.length = 0;
  sqlHandler = () => [];
});

// providerIdForUser(userId) -> `SELECT id FROM providers WHERE user_id = ? LIMIT 1`
const providersByUser = (map) => [
  'FROM providers WHERE user_id = ?',
  (p) => (map[Number(p[0])] != null ? [{ id: map[Number(p[0])] }] : []),
];

// ===========================================================================
// 1. ARGENT — PUT/DELETE /service-items/:id
//    (le trou le plus grave : un client pouvait réécrire le prix d'un prestataire)
// ===========================================================================

test('service-items PUT: un compte client ne peut pas modifier une prestation → 403, aucun Stripe', async (t) => {
  let updateCalled = false;
  withStubs(t, [ServiceItem, {
    findById: async () => ({ id: 42, provider_id: 5, title: 'Shooting', price: 300 }),
    update: async () => { updateCalled = true; return {}; },
  }]);
  const req = { params: { id: 42 }, body: { price: 1 }, user: { id: 3, role: 'client' } };
  const res = createMockRes();

  await serviceItemController.update(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(updateCalled, false);
  assert.equal(stripeCalls.length, 0, 'aucune synchro Stripe ne doit partir sur un refus');
});

test('service-items PUT: un prestataire ne peut pas modifier la prestation d’un autre → 403, aucun Stripe', async (t) => {
  let updateCalled = false;
  routeSql(providersByUser({ 7: 5 }));
  withStubs(t, [ServiceItem, {
    findById: async () => ({ id: 42, provider_id: 9, title: 'Traiteur', price: 800 }),
    update: async () => { updateCalled = true; return {}; },
  }]);
  const req = { params: { id: 42 }, body: { price: 1 }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await serviceItemController.update(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(updateCalled, false);
  assert.equal(stripeCalls.length, 0);
});

test('service-items PUT: le prestataire propriétaire → 200', async (t) => {
  const updateArgs = [];
  routeSql(providersByUser({ 7: 5 }));
  withStubs(t, [ServiceItem, {
    findById: async () => ({ id: 42, provider_id: 5, title: 'Pack', price: 200 }),
    update: async (id, payload) => { updateArgs.push({ id, payload }); return { id: 42, title: 'Pack', price: 0 }; },
  }]);
  const req = { params: { id: 42 }, body: { price: 250 }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await serviceItemController.update(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(updateArgs[0].id, 42);
});

test('service-items PUT: un admin modifie n’importe quelle prestation → 200', async (t) => {
  const updateArgs = [];
  withStubs(t, [ServiceItem, {
    findById: async () => ({ id: 42, provider_id: 9, title: 'X', price: 100 }),
    update: async (id, payload) => { updateArgs.push({ id, payload }); return { id: 42, title: 'X', price: 0 }; },
  }]);
  const req = { params: { id: 42 }, body: { price: 1 }, user: { id: 1, role: 'admin' } };
  const res = createMockRes();

  await serviceItemController.update(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(updateArgs.length >= 1);
});

test('service-items DELETE: un compte client → 403, aucun Stripe', async (t) => {
  let deleted = false;
  withStubs(t, [ServiceItem, {
    findById: async () => ({ id: 42, provider_id: 5 }),
    delete: async () => { deleted = true; },
  }]);
  const req = { params: { id: 42 }, user: { id: 3, role: 'client' } };
  const res = createMockRes();

  await serviceItemController.remove(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(deleted, false);
  assert.equal(stripeCalls.length, 0);
});

test('service-items DELETE: un prestataire sur la prestation d’un autre → 403, aucun Stripe', async (t) => {
  let deleted = false;
  routeSql(providersByUser({ 7: 5 }));
  withStubs(t, [ServiceItem, {
    findById: async () => ({ id: 42, provider_id: 9, stripe_product_id: 'prod_x' }),
    delete: async () => { deleted = true; },
  }]);
  const req = { params: { id: 42 }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await serviceItemController.remove(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(deleted, false);
  assert.equal(stripeCalls.length, 0, 'un refus ne doit pas désactiver le produit Stripe de la victime');
});

test('service-items DELETE: le prestataire propriétaire → 200', async (t) => {
  let deleted = false;
  routeSql(providersByUser({ 7: 5 }));
  withStubs(t, [ServiceItem, {
    findById: async () => ({ id: 42, provider_id: 5 }),
    delete: async () => { deleted = true; },
  }]);
  const req = { params: { id: 42 }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await serviceItemController.remove(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(deleted, true);
});

test('service-items DELETE: un admin → 200', async (t) => {
  let deleted = false;
  withStubs(t, [ServiceItem, {
    findById: async () => ({ id: 42, provider_id: 9 }),
    delete: async () => { deleted = true; },
  }]);
  const req = { params: { id: 42 }, user: { id: 1, role: 'admin' } };
  const res = createMockRes();

  await serviceItemController.remove(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(deleted, true);
});

// --- non-régression legacy : service_items sans provider_id -----------------
test('service-items (legacy) PUT: fiche sans provider_id, created_by = le prestataire → 200 (fallback Thabo 24/08)', async (t) => {
  const updateArgs = [];
  routeSql(providersByUser({ 7: 5 }));
  withStubs(t, [ServiceItem, {
    findById: async () => ({ id: 42, provider_id: null, created_by: 7, title: 'Fiche', price: 0 }),
    update: async (id, payload) => { updateArgs.push({ id, payload }); return { id: 42, title: 'Fiche', price: 0 }; },
  }]);
  const req = { params: { id: 42 }, body: { description: 'maj' }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await serviceItemController.update(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(updateArgs[0].id, 42);
});

test('service-items (legacy) PUT: fiche sans provider_id, created_by = un autre → 403', async (t) => {
  let updateCalled = false;
  routeSql(providersByUser({ 7: 5 }));
  withStubs(t, [ServiceItem, {
    findById: async () => ({ id: 42, provider_id: null, created_by: 999, title: 'Fiche', price: 0 }),
    update: async () => { updateCalled = true; return {}; },
  }]);
  const req = { params: { id: 42 }, body: { description: 'vol' }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await serviceItemController.update(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(updateCalled, false);
});

// ===========================================================================
// 2. SUPPRESSION
// ===========================================================================

// --- DELETE /providers/:id -------------------------------------------------
test('providers DELETE: un client → 403', async (t) => {
  let deleted = false;
  withStubs(t, [Provider, {
    findById: async () => ({ id: 10, user_id: 7 }),
    delete: async () => { deleted = true; },
  }]);
  const req = { params: { id: 10 }, user: { id: 3, role: 'client' } };
  const res = createMockRes();

  await providerController.remove(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(deleted, false);
});

test('providers DELETE: un autre prestataire → 403', async (t) => {
  let deleted = false;
  withStubs(t, [Provider, {
    findById: async () => ({ id: 10, user_id: 7 }),
    delete: async () => { deleted = true; },
  }]);
  const req = { params: { id: 10 }, user: { id: 99, role: 'provider' } };
  const res = createMockRes();

  await providerController.remove(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(deleted, false);
});

test('providers DELETE: le propriétaire → 200', async (t) => {
  let deleted = false;
  withStubs(t, [Provider, {
    findById: async () => ({ id: 10, user_id: 7 }),
    delete: async () => { deleted = true; },
  }]);
  const req = { params: { id: 10 }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await providerController.remove(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(deleted, true);
});

test('providers DELETE: un admin → 200', async (t) => {
  let deleted = false;
  withStubs(t, [Provider, {
    findById: async () => ({ id: 10, user_id: 7 }),
    delete: async () => { deleted = true; },
  }]);
  const req = { params: { id: 10 }, user: { id: 1, role: 'admin' } };
  const res = createMockRes();

  await providerController.remove(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(deleted, true);
});

// --- PUT/DELETE /platform-reviews/:id ------------------------------------
test('platform-reviews PUT: un tiers ne peut pas éditer un avis → 403', async (t) => {
  let updated = false;
  withStubs(t, [PlatformReview, {
    findById: async () => ({ id: 5, author_user_id: 20, comment: 'ok' }),
    update: async () => { updated = true; return {}; },
  }]);
  const req = { params: { id: 5 }, body: { comment: 'pirate' }, user: { id: 99, role: 'client' } };
  const res = createMockRes();

  await platformReviewController.update(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(updated, false);
});

test('platform-reviews PUT: l’auteur → 200', async (t) => {
  let updated = false;
  withStubs(t, [PlatformReview, {
    findById: async () => ({ id: 5, author_user_id: 20, comment: 'ok' }),
    update: async () => { updated = true; return { id: 5, comment: 'corrigé' }; },
  }]);
  const req = { params: { id: 5 }, body: { comment: 'corrigé' }, user: { id: 20, role: 'client' } };
  const res = createMockRes();

  await platformReviewController.update(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(updated, true);
});

test('platform-reviews PUT: un admin → 200', async (t) => {
  let updated = false;
  withStubs(t, [PlatformReview, {
    findById: async () => ({ id: 5, author_user_id: 20 }),
    update: async () => { updated = true; return { id: 5 }; },
  }]);
  const req = { params: { id: 5 }, body: { comment: 'modéré' }, user: { id: 1, role: 'admin' } };
  const res = createMockRes();

  await platformReviewController.update(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(updated, true);
});

test('platform-reviews DELETE: un tiers → 403', async (t) => {
  let deleted = false;
  withStubs(t, [PlatformReview, {
    findById: async () => ({ id: 5, author_user_id: 20 }),
    delete: async () => { deleted = true; },
  }]);
  const req = { params: { id: 5 }, user: { id: 99, role: 'client' } };
  const res = createMockRes();

  await platformReviewController.remove(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(deleted, false);
});

test('platform-reviews DELETE: l’auteur → 200', async (t) => {
  let deleted = false;
  withStubs(t, [PlatformReview, {
    findById: async () => ({ id: 5, author_user_id: 20 }),
    delete: async () => { deleted = true; },
  }]);
  const req = { params: { id: 5 }, user: { id: 20, role: 'client' } };
  const res = createMockRes();

  await platformReviewController.remove(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(deleted, true);
});

test('platform-reviews DELETE: un admin → 200', async (t) => {
  let deleted = false;
  withStubs(t, [PlatformReview, {
    findById: async () => ({ id: 5, author_user_id: 20 }),
    delete: async () => { deleted = true; },
  }]);
  const req = { params: { id: 5 }, user: { id: 1, role: 'admin' } };
  const res = createMockRes();

  await platformReviewController.remove(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(deleted, true);
});

// ===========================================================================
// 3. FUITES EN LECTURE
// ===========================================================================

// --- GET /offers , GET /offers/:id -------------------------------------
test('offers GET liste: un admin voit tout (CRUD de base, pas de requête ad hoc)', async (t) => {
  withStubs(t, [Offer, { findAll: async () => [{ id: 1 }, { id: 2 }] }]);
  const req = { query: {}, user: { id: 1, role: 'admin' } };
  const res = createMockRes();

  await offerController.getAll(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.length, 2);
  assert.equal(sqlCalls.length, 0);
});

test('offers GET liste: un prestataire ne voit que ses offres, même avec ?provider_id=<autre>', async () => {
  routeSql(
    providersByUser({ 7: 3 }),
    ['FROM `offers` o', () => [{ id: 1, provider_id: 3 }]],
  );
  const req = { query: { provider_id: '99' }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await offerController.getAll(req, res);

  assert.equal(res.statusCode, 200);
  const call = sqlCalls.find((c) => c.sql.includes('FROM `offers` o'));
  assert.ok(call, 'la liste doit être filtrée en SQL');
  assert.ok(call.params.map(String).includes('3'), 'le pid réel du prestataire est forcé dans le WHERE');
  assert.deepEqual(res.body, [{ id: 1, provider_id: 3 }]);
});

test('offers GET liste: un client ne voit que les offres de ses demandes (match legacy-safe)', async () => {
  routeSql(['FROM `offers` o', () => [{ id: 7, request_id: 4 }]]);
  const req = { query: { provider_id: '99' }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await offerController.getAll(req, res);

  assert.equal(res.statusCode, 200);
  const call = sqlCalls.find((c) => c.sql.includes('FROM `offers` o'));
  assert.ok(call.sql.includes('r.client_id = ?'));
  assert.ok(call.sql.includes('SELECT id FROM clients WHERE user_id = ?'), 'legacy clients.id ↔ users.id');
  assert.deepEqual(call.params.map(String), ['99', '50', '50']);
});

test('offers GET /offers/:id: un tiers → 403', async (t) => {
  routeSql(
    providersByUser({ 77: 5 }),
    ['client_id FROM service_requests WHERE id = ?', () => [{ client_id: 50 }]],
    ['user_id FROM clients WHERE id = ?', () => []],
  );
  withStubs(t, [Offer, { findById: async () => ({ id: 8, request_id: 4, provider_id: 9 }) }]);
  const req = { params: { id: 8 }, user: { id: 77, role: 'provider' } };
  const res = createMockRes();

  await offerController.getOne(req, res);

  assert.equal(res.statusCode, 403);
});

test('offers GET /offers/:id: le prestataire propriétaire → 200', async (t) => {
  routeSql(providersByUser({ 7: 9 }));
  withStubs(t, [Offer, { findById: async () => ({ id: 8, request_id: 4, provider_id: 9 }) }]);
  const req = { params: { id: 8 }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await offerController.getOne(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.id, 8);
});

test('offers GET /offers/:id: le client de la demande → 200', async (t) => {
  routeSql(
    providersByUser({}),
    ['client_id FROM service_requests WHERE id = ?', () => [{ client_id: 50 }]],
  );
  withStubs(t, [Offer, { findById: async () => ({ id: 8, request_id: 4, provider_id: 9 }) }]);
  const req = { params: { id: 8 }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await offerController.getOne(req, res);

  assert.equal(res.statusCode, 200);
});

test('offers (legacy) GET /offers/:id: service_requests.client_id pointe sur clients.id → le client accède quand même', async (t) => {
  routeSql(
    providersByUser({}),
    ['client_id FROM service_requests WHERE id = ?', () => [{ client_id: 12 }]],
    ['user_id FROM clients WHERE id = ?', (p) => (Number(p[0]) === 12 ? [{ user_id: 50 }] : [])],
  );
  withStubs(t, [Offer, { findById: async () => ({ id: 8, request_id: 4, provider_id: 9 }) }]);
  const req = { params: { id: 8 }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await offerController.getOne(req, res);

  assert.equal(res.statusCode, 200);
});

// --- GET /messages/:id ---------------------------------------------------
test('messages GET /messages/:id: un prestataire ne peut pas lire le fil client↔admin d’une demande → 403', async (t) => {
  withStubs(t, [Message, { findById: async () => ({ id: 3, sender_id: 100, request_id: 4, offer_id: null }) }]);
  const req = { params: { id: 3 }, user: { id: 77, role: 'provider' } };
  const res = createMockRes();

  await messageController.getOne(req, res);

  assert.equal(res.statusCode, 403);
});

test('messages GET /messages/:id: un prestataire ne peut pas lire le fil d’une offre qui n’est pas la sienne → 403', async (t) => {
  routeSql(['user_id FROM providers WHERE id = ?', (p) => (Number(p[0]) === 9 ? [{ user_id: 200 }] : [])]);
  withStubs(t,
    [Message, { findById: async () => ({ id: 3, sender_id: 100, request_id: 4, offer_id: 8 }) }],
    [Offer, { findById: async () => ({ id: 8, provider_id: 9 }) }],
  );
  const req = { params: { id: 3 }, user: { id: 77, role: 'provider' } };
  const res = createMockRes();

  await messageController.getOne(req, res);

  assert.equal(res.statusCode, 403);
});

test('messages GET /messages/:id: un client ne peut pas lire un fil d’offre → 403', async (t) => {
  withStubs(t, [Message, { findById: async () => ({ id: 3, sender_id: 100, request_id: 4, offer_id: 8 }) }]);
  const req = { params: { id: 3 }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await messageController.getOne(req, res);

  assert.equal(res.statusCode, 403);
});

test('messages GET /messages/:id: l’expéditeur relit son propre message → 200', async (t) => {
  withStubs(t, [Message, { findById: async () => ({ id: 3, sender_id: 50, request_id: 4, offer_id: null }) }]);
  const req = { params: { id: 3 }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await messageController.getOne(req, res);

  assert.equal(res.statusCode, 200);
});

test('messages GET /messages/:id: le client propriétaire lit le fil de sa demande → 200', async (t) => {
  routeSql(['user_id FROM clients WHERE id = ?', () => []]);
  withStubs(t,
    [Message, { findById: async () => ({ id: 3, sender_id: 100, request_id: 4, offer_id: null }) }],
    [ServiceRequest, { findById: async () => ({ id: 4, client_id: 50 }) }],
  );
  const req = { params: { id: 3 }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await messageController.getOne(req, res);

  assert.equal(res.statusCode, 200);
});

// --- GET /favorites/:id ------------------------------------------------
test('favorites GET /favorites/:id: un tiers ne peut pas lire le favori d’un autre client → 403', async (t) => {
  let findCalled = false;
  withStubs(t, [Favorite, { findById: async () => { findCalled = true; return { client_id: '5', provider_id: '9' }; } }]);
  const req = { params: { id: '5_9' }, user: { id: 99, role: 'client' } };
  const res = createMockRes();

  await favoriteController.getOne(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(findCalled, false);
});

test('favorites GET /favorites/:id: le client propriétaire → 200', async (t) => {
  withStubs(t, [Favorite, { findById: async () => ({ client_id: '5', provider_id: '9' }) }]);
  const req = { params: { id: '5_9' }, user: { id: 5, role: 'client' } };
  const res = createMockRes();

  await favoriteController.getOne(req, res);

  assert.equal(res.statusCode, 200);
});

test('favorites GET /favorites/:id: un admin → 200', async (t) => {
  withStubs(t, [Favorite, { findById: async () => ({ client_id: '5', provider_id: '9' }) }]);
  const req = { params: { id: '5_9' }, user: { id: 1, role: 'admin' } };
  const res = createMockRes();

  await favoriteController.getOne(req, res);

  assert.equal(res.statusCode, 200);
});

// --- GET /users/:id ---------------------------------------------------
test('users GET /users/:id: un compte ne peut pas lire le profil d’un autre → 403', async (t) => {
  let findCalled = false;
  withStubs(t, [User, { findById: async () => { findCalled = true; return { id: 5 }; } }]);
  const req = { params: { id: '5' }, user: { id: 99, role: 'client' } };
  const res = createMockRes();

  await userController.getOne(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(findCalled, false);
});

test('users GET /users/:id: soi-même → 200', async (t) => {
  withStubs(t, [User, { findById: async () => ({ id: 5, email: 'x@x.com' }) }]);
  const req = { params: { id: '5' }, user: { id: '5', role: 'client' } };
  const res = createMockRes();

  await userController.getOne(req, res);

  assert.equal(res.statusCode, 200);
});

test('users GET /users/:id: un admin → 200', async (t) => {
  withStubs(t, [User, { findById: async () => ({ id: 5 }) }]);
  const req = { params: { id: '5' }, user: { id: 1, role: 'admin' } };
  const res = createMockRes();

  await userController.getOne(req, res);

  assert.equal(res.statusCode, 200);
});

// --- GET /bookings , GET /bookings/:id (filtre forcé) -----------------
test('bookings GET liste: un prestataire ne voit que ses réservations, ?provider_id/?client_id ignorés', async (t) => {
  routeSql(providersByUser({ 7: 3 }));
  let opts = null;
  withStubs(t, [Booking, { findAll: async (o) => { opts = o; return []; } }]);
  const req = { query: { provider_id: '99', client_id: '50' }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await bookingController.getAll(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(opts.filters.provider_id, 3, 'filtre prestataire forcé au pid réel');
});

test('bookings GET liste: un client ne voit que ses réservations, ?provider_id ignoré', async (t) => {
  let opts = null;
  withStubs(t, [Booking, { findAll: async (o) => { opts = o; return []; } }]);
  const req = { query: { provider_id: '99' }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await bookingController.getAll(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(opts.filters.client_id, 50, 'filtre client forcé à l’id de l’appelant');
});

test('bookings GET liste: un admin n’est pas restreint', async (t) => {
  let opts = null;
  withStubs(t, [Booking, { findAll: async (o) => { opts = o; return [{ id: 1 }]; } }]);
  const req = { query: { provider_id: '99' }, user: { id: 1, role: 'admin' } };
  const res = createMockRes();

  await bookingController.getAll(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(opts.filters.provider_id, 99);
  assert.equal(opts.filters.client_id, undefined);
});

test('bookings GET liste: un prestataire sans profil provider → liste vide', async (t) => {
  routeSql(providersByUser({}));
  let findCalled = false;
  withStubs(t, [Booking, { findAll: async () => { findCalled = true; return [{ id: 1 }]; } }]);
  const req = { query: {}, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await bookingController.getAll(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, []);
  assert.equal(findCalled, false);
});

test('bookings GET /bookings/:id: un tiers → 403', async (t) => {
  routeSql(providersByUser({}));
  withStubs(t, [Booking, { findById: async () => ({ id: 1, client_id: 50, provider_id: 3 }) }]);
  const req = { params: { id: 1 }, user: { id: 99, role: 'client' } };
  const res = createMockRes();

  await bookingController.getOne(req, res);

  assert.equal(res.statusCode, 403);
});

test('bookings GET /bookings/:id: le client concerné → 200', async (t) => {
  withStubs(t, [Booking, { findById: async () => ({ id: 1, client_id: 50, provider_id: 3 }) }]);
  const req = { params: { id: 1 }, user: { id: 50, role: 'client' } };
  const res = createMockRes();

  await bookingController.getOne(req, res);

  assert.equal(res.statusCode, 200);
});

test('bookings GET /bookings/:id: le prestataire concerné → 200', async (t) => {
  routeSql(providersByUser({ 7: 3 }));
  withStubs(t, [Booking, { findById: async () => ({ id: 1, client_id: 50, provider_id: 3 }) }]);
  const req = { params: { id: 1 }, user: { id: 7, role: 'provider' } };
  const res = createMockRes();

  await bookingController.getOne(req, res);

  assert.equal(res.statusCode, 200);
});
