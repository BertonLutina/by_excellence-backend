const test = require('node:test');
const assert = require('node:assert/strict');

const { applyOfferFinancials } = require('../utils/offerFinancials');

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    sent: null,
    contentType: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    type(value) {
      this.contentType = value;
      return this;
    },
    send(payload) {
      this.sent = payload;
      return this;
    },
  };
}

function loadWithStubs(targetPath, stubMap) {
  const touched = [];

  for (const [requestPath, exports] of Object.entries(stubMap)) {
    const resolved = require.resolve(requestPath);
    touched.push({ resolved, previous: require.cache[resolved] });
    require.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports,
    };
  }

  const targetResolved = require.resolve(targetPath);
  const previousTarget = require.cache[targetResolved];
  delete require.cache[targetResolved];

  try {
    return require(targetPath);
  } finally {
    delete require.cache[targetResolved];
    if (previousTarget) {
      require.cache[targetResolved] = previousTarget;
    }

    for (const { resolved, previous } of touched.reverse()) {
      if (previous) {
        require.cache[resolved] = previous;
      } else {
        delete require.cache[resolved];
      }
    }
  }
}

test('goods-only offer financials use direct full payment flow', () => {
  const out = applyOfferFinancials(
    {
      items: [
        { item_type: 'good', price: 120, quantity: 1 },
        { item_type: 'good', price: 80, quantity: 1 },
      ],
      commission_mode: 'included',
      deposit_percentage: 30,
    },
    { provider_tier: 'standard' }
  );

  assert.equal(out.payment_flow, 'direct_full_payment');
  assert.equal(out.total_amount, 200);
  assert.equal(out.deposit_amount, 60);
});

test('service and mixed offer financials keep deposit payment flow', () => {
  const service = applyOfferFinancials(
    {
      items: [{ item_type: 'service', price: 300 }],
      commission_mode: 'included',
      deposit_percentage: 30,
    },
    { provider_tier: 'standard' }
  );
  const mixed = applyOfferFinancials(
    {
      items: [
        { item_type: 'good', price: 80 },
        { item_type: 'package', price: 400 },
      ],
      commission_mode: 'included',
      deposit_percentage: 30,
    },
    { provider_tier: 'standard' }
  );

  assert.equal(service.payment_flow, 'deposit_flow');
  assert.equal(mixed.payment_flow, 'deposit_flow');
});

test('accepting a goods offer creates one pending goods_full payment and no deposit', async () => {
  const createdPayments = [];
  const offer = {
    id: 44,
    request_id: 12,
    provider_id: 7,
    status: 'sent_to_client',
    payment_flow: 'direct_full_payment',
    total_amount: 240,
    deposit_amount: 72,
  };
  const controller = loadWithStubs('../controllers/offerRespondController', {
    '../models/Offer': {
      findById: async () => offer,
      update: async () => ({ ...offer, status: 'accepted' }),
    },
    '../models/ServiceRequest': {
      findById: async () => ({ id: 12, client_email: 'client@example.com' }),
      update: async () => ({ id: 12, status: 'offer_accepted' }),
    },
    '../models/Payment': {
      findAll: async ({ filters }) => createdPayments.filter((p) => (
        p.request_id === filters.request_id &&
        p.offer_id === filters.offer_id &&
        p.type === filters.type
      )),
      create: async (payload) => {
        createdPayments.push(payload);
        return { id: createdPayments.length, ...payload };
      },
    },
    '../utils/offerActionToken': {
      makeOfferActionToken: () => 'valid-token',
    },
    '../../constants/constant': {
      FRONTEND_ORIGIN: 'https://frontend.example',
    },
    '../services/notificationService': {
      notifyRequestStatusChange: async () => {},
      notifyOfferStatusChange: async () => {},
    },
  });

  const req = { query: { offer_id: 44, action: 'accept', token: 'valid-token' } };
  const res = createMockRes();
  await controller.get(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(createdPayments, [
    {
      request_id: 12,
      offer_id: 44,
      type: 'goods_full',
      amount: 240,
      status: 'pending',
    },
  ]);
});

test('accepting a service offer still creates a pending deposit payment', async () => {
  const createdPayments = [];
  const offer = {
    id: 45,
    request_id: 13,
    provider_id: 8,
    status: 'sent_to_client',
    payment_flow: 'deposit_flow',
    total_amount: 500,
    deposit_amount: 150,
  };
  const controller = loadWithStubs('../controllers/offerRespondController', {
    '../models/Offer': {
      findById: async () => offer,
      update: async () => ({ ...offer, status: 'accepted' }),
    },
    '../models/ServiceRequest': {
      findById: async () => ({ id: 13, client_email: 'client@example.com' }),
      update: async () => ({ id: 13, status: 'offer_accepted' }),
    },
    '../models/Payment': {
      findAll: async () => [],
      create: async (payload) => {
        createdPayments.push(payload);
        return { id: createdPayments.length, ...payload };
      },
    },
    '../utils/offerActionToken': {
      makeOfferActionToken: () => 'valid-token',
    },
    '../../constants/constant': {
      FRONTEND_ORIGIN: 'https://frontend.example',
    },
    '../services/notificationService': {
      notifyRequestStatusChange: async () => {},
      notifyOfferStatusChange: async () => {},
    },
  });

  const req = { query: { offer_id: 45, action: 'accept', token: 'valid-token' } };
  const res = createMockRes();
  await controller.get(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(createdPayments, [
    {
      request_id: 13,
      offer_id: 45,
      type: 'deposit',
      amount: 150,
      status: 'pending',
    },
  ]);
});

test('retrying an already accepted goods offer repairs a missing goods_full payment', async () => {
  const createdPayments = [];
  const offer = {
    id: 46,
    request_id: 14,
    provider_id: 9,
    status: 'accepted',
    payment_flow: 'direct_full_payment',
    total_amount: 320,
    deposit_amount: 96,
  };
  const controller = loadWithStubs('../controllers/offerRespondController', {
    '../models/Offer': {
      findById: async () => offer,
      update: async () => {
        throw new Error('accepted offer should not be updated on retry');
      },
    },
    '../models/ServiceRequest': {
      findById: async () => ({ id: 14, client_email: 'client@example.com' }),
      update: async () => {
        throw new Error('request should not be updated on retry');
      },
    },
    '../models/Payment': {
      findAll: async () => [],
      create: async (payload) => {
        createdPayments.push(payload);
        return { id: createdPayments.length, ...payload };
      },
    },
    '../utils/offerActionToken': {
      makeOfferActionToken: () => 'valid-token',
    },
    '../../constants/constant': {
      FRONTEND_ORIGIN: 'https://frontend.example',
    },
    '../services/notificationService': {
      notifyRequestStatusChange: async () => {},
      notifyOfferStatusChange: async () => {},
    },
  });

  const req = { query: { offer_id: 46, action: 'accept', token: 'valid-token' } };
  const res = createMockRes();
  await controller.get(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(createdPayments, [
    {
      request_id: 14,
      offer_id: 46,
      type: 'goods_full',
      amount: 320,
      status: 'pending',
    },
  ]);
});

test('client-created goods_full payment is allowed only for direct flow and uses offer total', async () => {
  let capturedPayment = null;
  const controller = loadWithStubs('../controllers/paymentController', {
    '../models/Payment': {
      findAll: async () => [],
      create: async (payload) => {
        capturedPayment = payload;
        return { id: 90, ...payload };
      },
    },
    '../models/Offer': {
      findById: async () => ({
        id: 44,
        request_id: 12,
        status: 'accepted',
        payment_flow: 'direct_full_payment',
        total_amount: 240,
        deposit_amount: 72,
      }),
    },
    '../models/ServiceRequest': {},
    '../services/paymentCommissionService': {},
    '../utils/paymentWindow': { getPaymentWindowStatus: () => ({ status: 'ok' }) },
    '../db/db': { executeSQL: async () => [] },
    '../utils/entityAccess': {
      isAdmin: () => false,
      providerIdForUser: async () => null,
      isRequestClient: async () => true,
    },
  });

  const req = {
    user: { id: 5, role: 'client' },
    body: {
      request_id: 12,
      offer_id: 44,
      type: 'goods_full',
      amount: 1,
      status: 'paid',
    },
  };
  const res = createMockRes();
  await controller.create(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(capturedPayment.amount, 240);
  assert.equal(capturedPayment.status, 'pending');
  assert.equal(capturedPayment.type, 'goods_full');
});

test('client-created goods_full payment requires an accepted direct flow offer', async () => {
  let createCalled = false;
  const controller = loadWithStubs('../controllers/paymentController', {
    '../models/Payment': {
      create: async () => {
        createCalled = true;
        return { id: 92 };
      },
      findAll: async () => [],
    },
    '../models/Offer': {
      findById: async () => ({
        id: 46,
        request_id: 14,
        status: 'sent_to_client',
        payment_flow: 'direct_full_payment',
        total_amount: 320,
        deposit_amount: 96,
      }),
    },
    '../models/ServiceRequest': {},
    '../services/paymentCommissionService': {},
    '../services/paymentPostProcessService': {},
    '../utils/paymentWindow': { getPaymentWindowStatus: () => ({ status: 'ok' }) },
    '../db/db': { executeSQL: async () => [] },
    '../utils/entityAccess': {
      isAdmin: () => false,
      providerIdForUser: async () => null,
      isRequestClient: async () => true,
    },
  });

  const req = {
    user: { id: 5, role: 'client' },
    body: { request_id: 14, offer_id: 46, type: 'goods_full', amount: 1 },
  };
  const res = createMockRes();
  await controller.create(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(createCalled, false);
});

test('client-created goods_full payment reuses the existing request offer payment', async () => {
  let createCalled = false;
  const existingPayment = {
    id: 93,
    request_id: 14,
    offer_id: 46,
    type: 'goods_full',
    amount: 320,
    status: 'pending',
  };
  const controller = loadWithStubs('../controllers/paymentController', {
    '../models/Payment': {
      create: async () => {
        createCalled = true;
        return { id: 94 };
      },
      findAll: async ({ filters }) => (
        filters.request_id === 14 &&
        filters.offer_id === 46 &&
        filters.type === 'goods_full'
          ? [existingPayment]
          : []
      ),
    },
    '../models/Offer': {
      findById: async () => ({
        id: 46,
        request_id: 14,
        status: 'accepted',
        payment_flow: 'direct_full_payment',
        total_amount: 320,
        deposit_amount: 96,
      }),
    },
    '../models/ServiceRequest': {},
    '../services/paymentCommissionService': {},
    '../services/paymentPostProcessService': {},
    '../utils/paymentWindow': { getPaymentWindowStatus: () => ({ status: 'ok' }) },
    '../db/db': { executeSQL: async () => [] },
    '../utils/entityAccess': {
      isAdmin: () => false,
      providerIdForUser: async () => null,
      isRequestClient: async () => true,
    },
  });

  const req = {
    user: { id: 5, role: 'client' },
    body: { request_id: 14, offer_id: 46, type: 'goods_full', amount: 1 },
  };
  const res = createMockRes();
  await controller.create(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, existingPayment);
  assert.equal(createCalled, false);
});

test('client-created goods_full payment is rejected for deposit flow offers', async () => {
  let createCalled = false;
  const controller = loadWithStubs('../controllers/paymentController', {
    '../models/Payment': {
      create: async () => {
        createCalled = true;
        return { id: 91 };
      },
    },
    '../models/Offer': {
      findById: async () => ({
        id: 45,
        request_id: 13,
        payment_flow: 'deposit_flow',
        total_amount: 500,
        deposit_amount: 150,
      }),
    },
    '../models/ServiceRequest': {},
    '../services/paymentCommissionService': {},
    '../utils/paymentWindow': { getPaymentWindowStatus: () => ({ status: 'ok' }) },
    '../db/db': { executeSQL: async () => [] },
    '../utils/entityAccess': {
      isAdmin: () => false,
      providerIdForUser: async () => null,
      isRequestClient: async () => true,
    },
  });

  const req = {
    user: { id: 5, role: 'client' },
    body: { request_id: 13, offer_id: 45, type: 'goods_full', amount: 1 },
  };
  const res = createMockRes();
  await controller.create(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(createCalled, false);
});

test('paid goods_full payment completes the service request', async () => {
  const statusUpdates = [];
  const { updateServiceRequestStatusAfterPayment } = loadWithStubs('../services/paymentPostProcessService', {
    '../models/Payment': {},
    '../models/ServiceRequest': {
      update: async (id, payload) => {
        statusUpdates.push({ id, payload });
        return { id, ...payload };
      },
    },
    '../models/Offer': {},
    '../services/paymentCommissionService': {},
    '../utils/paymentWindow': { computeFinalPaymentDueDate: () => new Date('2026-01-01T00:00:00Z') },
    '../services/invoicePdfService': {},
    '../services/objectStorage': {},
    '../../constants/constant': {},
    '../services/notificationService': {
      notifyRequestStatusChange: async () => {},
    },
  });

  await updateServiceRequestStatusAfterPayment(
    { id: 91, request_id: 13, offer_id: 45, type: 'goods_full', status: 'paid' },
    { id: 13, status: 'offer_accepted' },
    { fromWebhook: true }
  );

  assert.deepEqual(statusUpdates, [
    { id: 13, payload: { status: 'completed' } },
  ]);
});

test('admin update to paid goods_full runs payment post-processing', async () => {
  const postProcessed = [];
  const existingPayment = {
    id: 95,
    request_id: 15,
    offer_id: 47,
    type: 'goods_full',
    amount: 410,
    status: 'pending',
  };
  const updatedPayment = {
    ...existingPayment,
    status: 'paid',
    paid_date: '2026-01-02 03:04:05',
  };
  const controller = loadWithStubs('../controllers/paymentController', {
    '../models/Payment': {
      findById: async () => existingPayment,
      update: async (id, payload) => ({ id: Number(id), ...existingPayment, ...payload }),
      findAll: async () => [],
    },
    '../models/Offer': {},
    '../models/ServiceRequest': {
      findById: async (id) => ({ id, status: 'offer_accepted' }),
    },
    '../services/paymentCommissionService': {
      commissionFieldsForPaidTransition: async () => ({
        commission_rate_percent: 15,
        admin_commission_amount: 61.5,
        provider_net_amount: 348.5,
      }),
    },
    '../services/paymentPostProcessService': {
      updateServiceRequestStatusAfterPayment: async (payment, request, options) => {
        postProcessed.push({ payment, request, options });
      },
    },
    '../utils/paymentWindow': { getPaymentWindowStatus: () => ({ status: 'ok' }) },
    '../db/db': { executeSQL: async () => [] },
    '../utils/entityAccess': {
      isAdmin: () => true,
      providerIdForUser: async () => null,
      isRequestClient: async () => false,
    },
  });

  const req = {
    user: { id: 1, role: 'admin' },
    params: { id: 95 },
    body: { status: 'paid', paid_date: updatedPayment.paid_date },
  };
  const res = createMockRes();
  await controller.update(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(postProcessed.length, 1);
  assert.equal(postProcessed[0].payment.type, 'goods_full');
  assert.equal(postProcessed[0].payment.status, 'paid');
  assert.deepEqual(postProcessed[0].request, { id: 15, status: 'offer_accepted' });
  assert.deepEqual(postProcessed[0].options, { fromWebhook: false });
});

test('offer update recalculates payment_flow instead of trusting the request body', async () => {
  let capturedUpdate = null;
  const controller = loadWithStubs('../controllers/offerController', {
    '../models/Offer': {
      findById: async () => ({
        id: 45,
        request_id: 13,
        provider_id: 8,
        items: [{ item_type: 'service', price: 500 }],
        total_amount: 500,
        deposit_amount: 150,
        deposit_percentage: 30,
        commission_mode: 'included',
        payment_flow: 'deposit_flow',
        status: 'draft',
      }),
      update: async (id, payload) => {
        capturedUpdate = { id, payload };
        return { id, ...payload };
      },
    },
    '../db/db': {
      executeSQL: async () => [{ id: 8, provider_tier: 'standard' }],
    },
    '../services/notificationService': {
      notifyOfferStatusChange: async () => {},
    },
    '../services/serviceRequestCollaborationService': {
      providerCanCreateOffer: async () => true,
    },
    '../utils/entityAccess': {
      isAdmin: () => false,
      providerIdForUser: async () => 8,
      isOfferProvider: async () => true,
      isOfferClient: async () => false,
      pickFields: () => [{}, []],
    },
  });

  const req = {
    user: { id: 5, role: 'provider' },
    params: { id: 45 },
    body: { payment_flow: 'direct_full_payment' },
  };
  const res = createMockRes();
  await controller.update(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(capturedUpdate.payload.payment_flow, 'deposit_flow');
});
