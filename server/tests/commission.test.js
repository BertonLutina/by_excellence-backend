const test = require('node:test');
const assert = require('node:assert/strict');
const commission = require('../utils/commission');

test('standard and unclassified use configured standard rate', () => {
  const configuredStandard = commission.standardPercent();
  assert.equal(commission.getEffectiveCommissionPercent({ provider_tier: 'standard' }), configuredStandard);
  assert.equal(commission.getEffectiveCommissionPercent({ provider_tier: null }), configuredStandard);
});

test('premium uses 20 default or 30 when set', () => {
  assert.equal(commission.getEffectiveCommissionPercent({ provider_tier: 'premium', premium_commission_percent: null }), 20);
  assert.equal(commission.getEffectiveCommissionPercent({ provider_tier: 'premium', premium_commission_percent: 30 }), 30);
  assert.equal(commission.getEffectiveCommissionPercent({ provider_tier: 'premium', premium_commission_percent: 20 }), 20);
});

test('computePaymentBreakdown splits amount', () => {
  const configuredStandard = commission.standardPercent();
  const b = commission.computePaymentBreakdown(100, { provider_tier: 'standard' });
  assert.equal(b.commission_rate_percent, configuredStandard);
  assert.equal(b.admin_commission_amount, configuredStandard);
  assert.equal(b.provider_net_amount, 100 - configuredStandard);
  const p = commission.computePaymentBreakdown(100, { provider_tier: 'premium', premium_commission_percent: 30 });
  assert.equal(p.admin_commission_amount, 30);
  assert.equal(p.provider_net_amount, 70);
});
