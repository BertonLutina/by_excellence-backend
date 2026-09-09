const test = require('node:test');
const assert = require('node:assert/strict');

const controller = require('../controllers/stripeConnectController');
const webhookController = require('../controllers/stripeWebhookController');
const Provider = require('../models/Provider');
const User = require('../models/User');

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

function mockStripe({ accountId = 'acct_new123', accountLinkUrl = 'https://connect.stripe.com/setup/e/acct_new123' } = {}) {
  const calls = { accountsCreate: [], accountLinksCreate: [] };
  return {
    calls,
    accounts: {
      create: async (params) => {
        calls.accountsCreate.push(params);
        return { id: accountId };
      },
    },
    accountLinks: {
      create: async (params) => {
        calls.accountLinksCreate.push(params);
        return { url: accountLinkUrl };
      },
    },
  };
}

test('startOnboarding creates a new Connect account and returns an onboarding url', async () => {
  const originalFindById = Provider.findById;
  const originalUpdate = Provider.update;
  const originalUserFindById = User.findById;
  const updates = [];
  Provider.findById = async () => ({ id: 5, user_id: 7, structure_type: 'solo', stripe_account_id: null });
  Provider.update = async (id, payload) => { updates.push({ id, payload }); return { id, ...payload }; };
  User.findById = async () => ({ id: 7, email: 'provider@example.com' });

  const stripe = mockStripe();
  const req = { params: { id: 5 }, user: { id: 7, role: 'provider' }, stripe };
  const res = createMockRes();

  await controller.startOnboarding(req, res);

  Provider.findById = originalFindById;
  Provider.update = originalUpdate;
  User.findById = originalUserFindById;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.url, 'https://connect.stripe.com/setup/e/acct_new123');
  assert.equal(stripe.calls.accountsCreate.length, 1);
  assert.equal(stripe.calls.accountsCreate[0].type, 'express');
  assert.equal(stripe.calls.accountsCreate[0].business_type, 'individual');
  assert.equal(stripe.calls.accountsCreate[0].email, 'provider@example.com');
  assert.equal(stripe.calls.accountLinksCreate[0].account, 'acct_new123');
  // exactly one DB write, persisting the new account id + pending status
  assert.equal(updates.length, 1);
  assert.equal(updates[0].payload.stripe_account_id, 'acct_new123');
  assert.equal(updates[0].payload.stripe_connect_status, 'pending');
});

test('startOnboarding is idempotent: reuses an existing account instead of creating a duplicate', async () => {
  const originalFindById = Provider.findById;
  const originalUpdate = Provider.update;
  Provider.findById = async () => ({
    id: 5,
    user_id: 7,
    structure_type: 'team',
    stripe_account_id: 'acct_existing',
    stripe_connect_status: 'active',
  });
  let updateCalled = false;
  Provider.update = async () => { updateCalled = true; };

  const stripe = mockStripe();
  const req = { params: { id: 5 }, user: { id: 7, role: 'provider' }, stripe };
  const res = createMockRes();

  await controller.startOnboarding(req, res);

  Provider.findById = originalFindById;
  Provider.update = originalUpdate;

  assert.equal(res.statusCode, 200);
  assert.equal(stripe.calls.accountsCreate.length, 0, 'must not create a second Stripe account');
  assert.equal(stripe.calls.accountLinksCreate[0].account, 'acct_existing');
  assert.equal(updateCalled, false, 'status already active, no DB write needed');
});

test('startOnboarding rejects a caller who does not own the provider', async () => {
  const originalFindById = Provider.findById;
  Provider.findById = async () => ({ id: 5, user_id: 7, stripe_account_id: null });

  const stripe = mockStripe();
  const req = { params: { id: 5 }, user: { id: 999, role: 'provider' }, stripe };
  const res = createMockRes();

  await controller.startOnboarding(req, res);

  Provider.findById = originalFindById;

  assert.equal(res.statusCode, 403);
  assert.equal(stripe.calls.accountsCreate.length, 0);
});

test('startOnboarding returns 404 for an unknown provider', async () => {
  const originalFindById = Provider.findById;
  Provider.findById = async () => null;

  const req = { params: { id: 999 }, user: { id: 7, role: 'provider' }, stripe: mockStripe() };
  const res = createMockRes();

  await controller.startOnboarding(req, res);

  Provider.findById = originalFindById;

  assert.equal(res.statusCode, 404);
});

test('getStatus returns cached status without calling Stripe', async () => {
  const originalFindById = Provider.findById;
  Provider.findById = async () => ({
    id: 5,
    user_id: 7,
    stripe_account_id: 'acct_existing',
    stripe_connect_status: 'active',
    stripe_payouts_enabled: 1,
  });

  const stripe = mockStripe();
  const req = { params: { id: 5 }, user: { id: 7, role: 'provider' }, stripe };
  const res = createMockRes();

  await controller.getStatus(req, res);

  Provider.findById = originalFindById;

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { connected: true, status: 'active', payouts_enabled: true });
  assert.equal(stripe.calls.accountsCreate.length, 0);
});

test('getStatus rejects a non-owner, non-admin caller', async () => {
  const originalFindById = Provider.findById;
  Provider.findById = async () => ({ id: 5, user_id: 7 });

  const req = { params: { id: 5 }, user: { id: 999, role: 'provider' }, stripe: mockStripe() };
  const res = createMockRes();

  await controller.getStatus(req, res);

  Provider.findById = originalFindById;

  assert.equal(res.statusCode, 403);
});

// --- webhook: account.updated keeps DB status in sync ----------------------

test('account.updated webhook marks the provider active once payouts+charges are enabled', async () => {
  const originalFindAll = Provider.findAll;
  const originalUpdate = Provider.update;
  let capturedUpdate = null;
  Provider.findAll = async ({ filters }) => {
    assert.equal(filters.stripe_account_id, 'acct_existing');
    return [{ id: 5, stripe_account_id: 'acct_existing' }];
  };
  Provider.update = async (id, payload) => { capturedUpdate = { id, payload }; };

  await webhookController.handleAccountUpdated({
    id: 'acct_existing',
    payouts_enabled: true,
    charges_enabled: true,
    requirements: { disabled_reason: null },
  });

  Provider.findAll = originalFindAll;
  Provider.update = originalUpdate;

  assert.equal(capturedUpdate.id, 5);
  assert.equal(capturedUpdate.payload.stripe_connect_status, 'active');
  assert.equal(capturedUpdate.payload.stripe_payouts_enabled, 1);
});

test('account.updated webhook marks the provider restricted when Stripe disables it', async () => {
  const originalFindAll = Provider.findAll;
  const originalUpdate = Provider.update;
  let capturedUpdate = null;
  Provider.findAll = async () => [{ id: 5, stripe_account_id: 'acct_existing' }];
  Provider.update = async (id, payload) => { capturedUpdate = { id, payload }; };

  await webhookController.handleAccountUpdated({
    id: 'acct_existing',
    payouts_enabled: false,
    charges_enabled: false,
    requirements: { disabled_reason: 'requirements.past_due' },
  });

  Provider.findAll = originalFindAll;
  Provider.update = originalUpdate;

  assert.equal(capturedUpdate.payload.stripe_connect_status, 'restricted');
  assert.equal(capturedUpdate.payload.stripe_payouts_enabled, 0);
});

test('account.updated webhook is a no-op for an account we do not recognize', async () => {
  const originalFindAll = Provider.findAll;
  const originalUpdate = Provider.update;
  let updateCalled = false;
  Provider.findAll = async () => [];
  Provider.update = async () => { updateCalled = true; };

  await webhookController.handleAccountUpdated({ id: 'acct_unknown', payouts_enabled: true, charges_enabled: true });

  Provider.findAll = originalFindAll;
  Provider.update = originalUpdate;

  assert.equal(updateCalled, false);
});
