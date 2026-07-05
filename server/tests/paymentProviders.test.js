const test = require('node:test');
const assert = require('node:assert/strict');

const money = require('../payments/money');
const { getPaymentProvider, byId, listProviders } = require('../payments/registry');
const { NotConfiguredError } = require('../payments/PaymentProvider');

// --- money: currency-aware minor units ------------------------------------

test('money: 2-decimal currencies convert to cents', () => {
  assert.equal(money.toMinorUnits(15.5, 'USD'), 1550);
  assert.equal(money.toMinorUnits(1000, 'NGN'), 100000);
  assert.equal(money.fromMinorUnits(1550, 'USD'), 15.5);
});

test('money: zero-decimal currencies convert 1:1', () => {
  assert.equal(money.toMinorUnits(1500, 'XOF'), 1500);
  assert.equal(money.toMinorUnits(2500, 'RWF'), 2500);
  assert.equal(money.toMinorUnits(1000, 'JPY'), 1000);
  assert.equal(money.isZeroDecimal('XOF'), true);
  assert.equal(money.isZeroDecimal('KES'), false);
});

test('money: three-decimal currency', () => {
  assert.equal(money.toMinorUnits(1.234, 'TND'), 1234);
  assert.equal(money.decimalsFor('TND'), 3);
});

test('money: unknown currency defaults to 2 decimals', () => {
  assert.equal(money.decimalsFor('ZZZ'), 2);
  assert.equal(money.toMinorUnits(10, 'ZZZ'), 1000);
});

test('money: roundMajor respects currency precision', () => {
  assert.equal(money.roundMajor(1500.7, 'XOF'), 1501); // 0-decimal
  assert.equal(money.roundMajor(15.005, 'USD'), 15.01);
});

// --- registry: selection --------------------------------------------------

test('registry: defaults to Stripe when nothing forces otherwise', () => {
  const gw = getPaymentProvider({});
  assert.equal(gw.capabilities().id, 'stripe');
});

test('registry: Stripe advertises card + payouts', () => {
  const caps = byId('stripe').capabilities();
  assert.ok(caps.methods.includes('card'));
  assert.equal(caps.payouts, true);
});

test('registry: lists every adapter', () => {
  const ids = listProviders().map((c) => c.id);
  assert.ok(ids.includes('stripe'));
  assert.equal(ids.length >= 2, true);
});

test('registry: mobile-money method routes to configured mobile provider', () => {
  const prev = process.env.PAYMENT_MOBILE_PROVIDER;
  process.env.PAYMENT_MOBILE_PROVIDER = 'flutterwave';
  try {
    const gw = getPaymentProvider({ method: 'mobile_money' });
    assert.equal(gw.capabilities().id, 'flutterwave');
    // African currency Stripe won't settle -> mobile
    assert.equal(getPaymentProvider({ currency: 'KES' }).capabilities().id, 'flutterwave');
    // USD stays on Stripe even with mobile configured
    assert.equal(getPaymentProvider({ currency: 'USD' }).capabilities().id, 'stripe');
  } finally {
    if (prev === undefined) delete process.env.PAYMENT_MOBILE_PROVIDER;
    else process.env.PAYMENT_MOBILE_PROVIDER = prev;
  }
});

test('registry: mobile method falls back to Stripe when unconfigured', () => {
  const prev = process.env.PAYMENT_MOBILE_PROVIDER;
  delete process.env.PAYMENT_MOBILE_PROVIDER;
  try {
    const gw = getPaymentProvider({ method: 'mobile_money' });
    assert.equal(gw.capabilities().id, 'stripe');
  } finally {
    if (prev !== undefined) process.env.PAYMENT_MOBILE_PROVIDER = prev;
  }
});

// --- mobile stub: fails loudly, never silently ----------------------------

test('mobile stub throws NotConfiguredError without keys', async () => {
  const prev = process.env.PAYMENT_MOBILE_PROVIDER;
  const prevKey = process.env.FLUTTERWAVE_SECRET_KEY;
  process.env.PAYMENT_MOBILE_PROVIDER = 'flutterwave';
  delete process.env.FLUTTERWAVE_SECRET_KEY;
  try {
    const gw = byId('flutterwave');
    await assert.rejects(
      () => gw.createCheckout({ amount: 100, currency: 'KES', reference: 'r1' }),
      (err) => err instanceof NotConfiguredError && err.code === 'PROVIDER_NOT_CONFIGURED'
    );
  } finally {
    if (prev === undefined) delete process.env.PAYMENT_MOBILE_PROVIDER;
    else process.env.PAYMENT_MOBILE_PROVIDER = prev;
    if (prevKey !== undefined) process.env.FLUTTERWAVE_SECRET_KEY = prevKey;
  }
});
