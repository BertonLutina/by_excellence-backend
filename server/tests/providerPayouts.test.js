const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controller = require('../controllers/providerPayoutController');
const Payment = require('../models/Payment');
const Offer = require('../models/Offer');
const ProviderPayout = require('../models/ProviderPayout');
const paymentCommissionService = require('../services/paymentCommissionService');
const { buildCheckoutPaymentSession, assertPlatformCharge } = require('../utils/platformCharge');

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

function paidPayment(overrides = {}) {
  return {
    id: 9,
    request_id: 3,
    offer_id: 4,
    status: 'paid',
    amount: 100,
    provider_net_amount: 85,
    escrow_status: null,
    ...overrides,
  };
}

test('platform checkout session charges the full amount with no Connect fields', () => {
  const session = buildCheckoutPaymentSession({
    currency: 'eur',
    productName: 'Acompte',
    productDescription: 'Mission',
    unitAmount: 10000,
    successUrl: 'https://example.test/ok',
    cancelUrl: 'https://example.test/cancel',
    metadata: { payment_id: '9', payment_type: 'deposit' },
  });
  assert.equal(session.line_items[0].price_data.unit_amount, 10000);
  assert.equal(session.mode, 'payment');
  assert.equal('payment_method_types' in session, false);
  const blob = JSON.stringify(session);
  for (const key of ['transfer_data', 'application_fee_amount', 'on_behalf_of', 'stripeAccount']) {
    assert.equal(blob.includes(key), false);
  }
});

test('assertPlatformCharge rejects a destination charge', () => {
  assert.throws(
    () => assertPlatformCharge({ transfer_data: { destination: 'acct_123' } }),
    /transfer_data/
  );
});

test('create payout records the provider net once and a second click returns the same order', async () => {
  const originalFindPayment = Payment.findById;
  const originalFindOffer = Offer.findById;
  const originalFindPayout = ProviderPayout.findByPaymentId;
  const originalCreate = ProviderPayout.create;
  let creates = 0;
  let stored = null;

  Payment.findById = async () => paidPayment();
  Offer.findById = async () => ({ id: 4, provider_id: 12 });
  ProviderPayout.findByPaymentId = async () => stored;
  ProviderPayout.create = async (data) => {
    creates += 1;
    stored = { id: 41, ...data, created_at: '2026-09-22 12:00:00' };
    return stored;
  };

  const req = { body: { payment_id: 9 }, user: { id: 1, role: 'admin' } };
  const first = createMockRes();
  await controller.create(req, first);
  const second = createMockRes();
  await controller.create(req, second);

  Payment.findById = originalFindPayment;
  Offer.findById = originalFindOffer;
  ProviderPayout.findByPaymentId = originalFindPayout;
  ProviderPayout.create = originalCreate;

  assert.equal(creates, 1);
  assert.equal(first.statusCode, 201);
  assert.equal(first.body.created, true);
  assert.equal(first.body.payout.amount, 85);
  assert.equal(first.body.payout.provider_id, 12);
  assert.equal(first.body.payout.status, 'to_pay');
  assert.equal(first.body.payout.currency, 'EUR');
  assert.equal('stripe_account_id' in first.body.payout, false);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.created, false);
  assert.equal(second.body.payout.id, 41);
});

test('create payout recalculates the net from the offer when the payment has none', async () => {
  const originalFindPayment = Payment.findById;
  const originalFindOffer = Offer.findById;
  const originalFindPayout = ProviderPayout.findByPaymentId;
  const originalCreate = ProviderPayout.create;
  const originalBreakdown = paymentCommissionService.computeBreakdownForPayment;
  let captured = null;

  Payment.findById = async () => paidPayment({ provider_net_amount: null });
  Offer.findById = async () => ({ id: 4, provider_id: 7 });
  ProviderPayout.findByPaymentId = async () => null;
  paymentCommissionService.computeBreakdownForPayment = async () => ({
    provider_net_amount: 70,
  });
  ProviderPayout.create = async (data) => {
    captured = data;
    return { id: 2, ...data };
  };

  const res = createMockRes();
  await controller.create({ body: { payment_id: 9 }, user: { id: 1 } }, res);

  Payment.findById = originalFindPayment;
  Offer.findById = originalFindOffer;
  ProviderPayout.findByPaymentId = originalFindPayout;
  ProviderPayout.create = originalCreate;
  paymentCommissionService.computeBreakdownForPayment = originalBreakdown;

  assert.equal(res.statusCode, 201);
  assert.equal(captured.amount, 70);
});

test('create payout refuses an unpaid payment, a held escrow, and a zero net', async () => {
  const originalFindPayment = Payment.findById;
  const originalFindOffer = Offer.findById;
  const originalFindPayout = ProviderPayout.findByPaymentId;
  ProviderPayout.findByPaymentId = async () => null;
  Offer.findById = async () => ({ id: 4, provider_id: 12 });

  Payment.findById = async () => paidPayment({ status: 'pending' });
  const unpaid = createMockRes();
  await controller.create({ body: { payment_id: 9 }, user: { id: 1 } }, unpaid);
  assert.equal(unpaid.statusCode, 400);
  assert.equal(unpaid.body.code, 'PAYMENT_NOT_PAID');

  Payment.findById = async () => paidPayment({ escrow_status: 'held' });
  const held = createMockRes();
  await controller.create({ body: { payment_id: 9 }, user: { id: 1 } }, held);
  assert.equal(held.statusCode, 400);
  assert.equal(held.body.code, 'ESCROW_HELD');

  Payment.findById = async () => paidPayment({ escrow_status: 'disputed' });
  const disputed = createMockRes();
  await controller.create({ body: { payment_id: 9 }, user: { id: 1 } }, disputed);
  assert.equal(disputed.statusCode, 400);
  assert.equal(disputed.body.code, 'ESCROW_DISPUTED');

  Payment.findById = async () => paidPayment({ provider_net_amount: 0, escrow_status: 'released' });
  const zero = createMockRes();
  await controller.create({ body: { payment_id: 9 }, user: { id: 1 } }, zero);
  assert.equal(zero.statusCode, 400);
  assert.equal(zero.body.code, 'PAYOUT_AMOUNT_INVALID');

  Payment.findById = originalFindPayment;
  Offer.findById = originalFindOffer;
  ProviderPayout.findByPaymentId = originalFindPayout;
});

test('markPaid confirms the bank transfer without creating another order', async () => {
  const originalFind = ProviderPayout.findById;
  const originalUpdate = ProviderPayout.update;
  const originalPayment = Payment.findById;
  Payment.findById = async () => paidPayment();
  let updates = 0;
  ProviderPayout.findById = async () => ({
    id: 41,
    payment_id: 9,
    provider_id: 12,
    amount: 85,
    currency: 'EUR',
    status: 'to_pay',
    created_by: 1,
    created_at: '2026-09-22 12:00:00',
  });
  ProviderPayout.update = async (id, data) => {
    updates += 1;
    return { id, payment_id: 9, provider_id: 12, amount: 85, currency: 'EUR', created_by: 1, ...data };
  };

  const res = createMockRes();
  await controller.markPaid({ params: { id: 41 }, user: { id: 8 }, body: { bank_reference: 'VIR-2026-09' } }, res);

  ProviderPayout.findById = async () => ({
    id: 41,
    payment_id: 9,
    provider_id: 12,
    amount: 85,
    currency: 'EUR',
    status: 'paid',
    created_by: 1,
    paid_by: 8,
    paid_at: '2026-09-22 13:00:00',
  });
  const again = createMockRes();
  await controller.markPaid({ params: { id: 41 }, user: { id: 8 } }, again);

  ProviderPayout.findById = originalFind;
  ProviderPayout.update = originalUpdate;
  Payment.findById = originalPayment;

  assert.equal(updates, 1);
  assert.equal(res.body.payout.status, 'paid');
  assert.equal(res.body.payout.paid_by, 8);
  assert.equal(res.body.payout.bank_reference, 'VIR-2026-09');
  assert.equal(again.body.payout.status, 'paid');
});

test('markPaid refuses a refunded payment and a missing bank reference', async () => {
  const originalFind = ProviderPayout.findById;
  const originalPayment = Payment.findById;
  const originalUpdate = ProviderPayout.update;
  let updates = 0;
  ProviderPayout.findById = async () => ({
    id: 41, payment_id: 9, provider_id: 12, amount: 85, currency: 'EUR', status: 'to_pay', created_by: 1,
  });
  ProviderPayout.update = async () => { updates += 1; };
  Payment.findById = async () => paidPayment({ status: 'refunded' });

  const refunded = createMockRes();
  await controller.markPaid({ params: { id: 41 }, user: { id: 8 }, body: { bank_reference: 'VIR-1' } }, refunded);
  assert.equal(refunded.statusCode, 400);
  assert.equal(refunded.body.code, 'ESCROW_REFUNDED');

  Payment.findById = async () => paidPayment({ escrow_status: 'disputed' });
  const disputed = createMockRes();
  await controller.markPaid({ params: { id: 41 }, user: { id: 8 }, body: { bank_reference: 'VIR-1' } }, disputed);
  assert.equal(disputed.statusCode, 400);
  assert.equal(disputed.body.code, 'ESCROW_DISPUTED');

  Payment.findById = async () => paidPayment();
  const missingRef = createMockRes();
  await controller.markPaid({ params: { id: 41 }, user: { id: 8 }, body: {} }, missingRef);
  assert.equal(missingRef.statusCode, 400);
  assert.equal(missingRef.body.code, 'BANK_REFERENCE_REQUIRED');
  assert.equal(updates, 0);

  ProviderPayout.findById = originalFind;
  Payment.findById = originalPayment;
  ProviderPayout.update = originalUpdate;
});

test('create and markPaid require an authenticated user id', async () => {
  const created = createMockRes();
  await controller.create({ body: { payment_id: 9 }, user: {} }, created);
  assert.equal(created.statusCode, 401);
  assert.equal(created.body.code, 'AUTH_REQUIRED');

  const paid = createMockRes();
  await controller.markPaid({ params: { id: 1 }, user: { role: 'admin' }, body: { bank_reference: 'X' } }, paid);
  assert.equal(paid.statusCode, 401);
});

test('create refuses to pay a partnership net to the lead alone', async () => {
  const originalFindPayment = Payment.findById;
  const originalFindOffer = Offer.findById;
  const originalFindPayout = ProviderPayout.findByPaymentId;
  const originalCreate = ProviderPayout.create;
  let creates = 0;
  Payment.findById = async () => paidPayment();
  Offer.findById = async () => ({ id: 4, provider_id: 12, partnership_id: 3 });
  ProviderPayout.findByPaymentId = async () => null;
  ProviderPayout.create = async () => { creates += 1; };

  const res = createMockRes();
  await controller.create({ body: { payment_id: 9 }, user: { id: 1 } }, res);

  Payment.findById = originalFindPayment;
  Offer.findById = originalFindOffer;
  ProviderPayout.findByPaymentId = originalFindPayout;
  ProviderPayout.create = originalCreate;

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'PARTNERSHIP_PAYOUT_UNSUPPORTED');
  assert.equal(creates, 0);
});

test('living server code no longer starts Stripe Connect', () => {
  const root = path.join(__dirname, '..');
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name === 'tests') continue;
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.js')) files.push(full);
    }
  };
  walk(root);
  const blob = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.equal(blob.includes('accounts.create'), false);
  assert.equal(blob.includes('accountLinks.create'), false);
  assert.equal(blob.includes('/stripe-connect'), false);
  assert.equal(blob.includes('webhook/connect'), false);
  const adapter = fs.readFileSync(path.join(root, 'payments/adapters/stripeAdapter.js'), 'utf8');
  const escrow = fs.readFileSync(path.join(root, 'controllers/escrowController.js'), 'utf8');
  assert.equal(blob.includes('payouts.create'), false);
  assert.equal(adapter.includes('payouts.create'), false);
  assert.equal(escrow.includes('createPayout'), false);
  assert.equal(fs.existsSync(path.join(root, 'controllers/stripeConnectController.js')), false);
});
