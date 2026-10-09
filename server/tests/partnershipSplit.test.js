const test = require('node:test');
const assert = require('node:assert/strict');

const {
  clampLeadSharePercent,
  computePartnershipSplit,
  executePartnershipPayouts,
  isPartnershipLive,
  effectivePartnershipStatus,
  buildComboPayloadFromPartnership,
  canModifyCombo,
} = require('../utils/partnershipSplit');
const { PARTNERSHIP_SPLIT_PAYOUTS_ENABLED } = require('../../constants/constant');

test('PARTNERSHIP_SPLIT_PAYOUTS_ENABLED defaults to false', () => {
  assert.equal(PARTNERSHIP_SPLIT_PAYOUTS_ENABLED, false);
});

test('clampLeadSharePercent keeps 1–99 and defaults to 50', () => {
  assert.equal(clampLeadSharePercent(undefined), 50);
  assert.equal(clampLeadSharePercent(0), 1);
  assert.equal(clampLeadSharePercent(100), 99);
  assert.equal(clampLeadSharePercent(60), 60);
});

test('percent split: commission once on total, then net 60/40', () => {
  const split = computePartnershipSplit({
    items: [{ price: 1000 }],
    commissionMode: 'included',
    commissionRatePercent: 15,
    leadSharePercent: 60,
    leadProviderId: 1,
    partnerProviderId: 2,
  });
  assert.equal(split.client_total, 1000);
  assert.equal(split.commission_amount, 150);
  assert.equal(split.provider_net, 850);
  assert.equal(split.lead_net, 510);
  assert.equal(split.partner_net, 340);
  assert.equal(split.split_basis, 'percent');
  assert.equal(split.payouts_enabled, false);
  assert.equal(split.payouts_executed, false);
});

test('line split: owner_provider_id shares net after a single commission', () => {
  const split = computePartnershipSplit({
    items: [
      { price: 600, owner_provider_id: 1 },
      { price: 400, owner_provider_id: 2 },
    ],
    commissionMode: 'included',
    commissionRatePercent: 20,
    leadSharePercent: 50,
    leadProviderId: 1,
    partnerProviderId: 2,
  });
  assert.equal(split.client_total, 1000);
  assert.equal(split.commission_amount, 200);
  assert.equal(split.provider_net, 800);
  assert.equal(split.lead_net, 480);
  assert.equal(split.partner_net, 320);
  assert.equal(split.split_basis, 'lines');
});

test('executePartnershipPayouts never transfers while flag is off', () => {
  const result = executePartnershipPayouts({ lead_net: 100, partner_net: 50 });
  assert.equal(result.executed, false);
  assert.match(result.reason, /PARTNERSHIP_SPLIT_PAYOUTS_ENABLED/);
  assert.equal(result.split.payouts_executed, false);
});

test('isPartnershipLive requires accepted window and active providers', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  assert.equal(isPartnershipLive({ status: 'invited' }, now), false);
  assert.equal(isPartnershipLive({
    status: 'accepted',
    starts_at: '2026-01-01',
    ends_at: '2026-12-31',
    lead_status: 'active',
    partner_status: 'active',
  }, now), true);
  assert.equal(isPartnershipLive({
    status: 'accepted',
    ends_at: '2026-01-01',
    lead_status: 'active',
    partner_status: 'active',
  }, now), false);
  assert.equal(isPartnershipLive({
    status: 'accepted',
    lead_status: 'active',
    partner_status: 'suspended',
  }, now), false);
  assert.equal(effectivePartnershipStatus({
    status: 'accepted',
    ends_at: '2026-01-01',
  }, now), 'expired');
});

test('IDOR: partner cannot modify the lead combo', () => {
  const partnership = { lead_provider_id: 10, partner_provider_id: 20 };
  assert.equal(canModifyCombo(10, partnership), true);
  assert.equal(canModifyCombo(20, partnership), false);
  assert.equal(canModifyCombo(99, partnership), false);
});

test('combo payload is lead + partner and tagged with partnership_id', () => {
  const payload = buildComboPayloadFromPartnership({
    id: 7,
    lead_provider_id: 10,
    partner_provider_id: 20,
    combo_title: 'Mariage photo + vidéo',
  });
  assert.equal(payload.primary_provider_id, 10);
  assert.equal(payload.partnership_id, 7);
  assert.equal(payload.lines.length, 2);
  assert.equal(payload.lines[0].role, 'lead');
  assert.equal(payload.lines[1].provider_id, 20);
});
