const test = require('node:test');
const assert = require('node:assert/strict');
const commission = require('../utils/commission');

test('standard and unclassified use 15%', () => {
  assert.equal(commission.getEffectiveCommissionPercent({ provider_tier: 'standard' }), 15);
  assert.equal(commission.getEffectiveCommissionPercent({ provider_tier: null }), 15);
});

test('premium uses 20 default or 30 when set', () => {
  assert.equal(commission.getEffectiveCommissionPercent({ provider_tier: 'premium', premium_commission_percent: null }), 20);
  assert.equal(commission.getEffectiveCommissionPercent({ provider_tier: 'premium', premium_commission_percent: 30 }), 30);
  assert.equal(commission.getEffectiveCommissionPercent({ provider_tier: 'premium', premium_commission_percent: 20 }), 20);
});

test('computePaymentBreakdown splits amount', () => {
  const b = commission.computePaymentBreakdown(100, { provider_tier: 'standard' });
  assert.equal(b.commission_rate_percent, 15);
  assert.equal(b.admin_commission_amount, 15);
  assert.equal(b.provider_net_amount, 85);
  const p = commission.computePaymentBreakdown(100, { provider_tier: 'premium', premium_commission_percent: 30 });
  assert.equal(p.admin_commission_amount, 30);
  assert.equal(p.provider_net_amount, 70);
});
