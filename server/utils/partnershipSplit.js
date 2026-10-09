const { PARTNERSHIP_SPLIT_PAYOUTS_ENABLED } = require('../../constants/constant');
const { computeOfferFinancials, lineAmount, roundMoney2, normalizeCommissionMode } = require('./offerFinancials');

const DEFAULT_LEAD_SHARE = 50;
const MIN_LEAD_SHARE = 1;
const MAX_LEAD_SHARE = 99;

function clampLeadSharePercent(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LEAD_SHARE;
  return Math.min(MAX_LEAD_SHARE, Math.max(MIN_LEAD_SHARE, Math.round(n * 100) / 100));
}

/**
 * Commission is taken once on the client total, then the remaining provider net
 * is split between lead (A) and partner (B). Never trusts a browser `amount`.
 *
 * @param {object} opts
 * @param {Array} opts.items
 * @param {string} [opts.commissionMode]
 * @param {number} opts.commissionRatePercent
 * @param {number} opts.leadSharePercent
 * @param {number} opts.leadProviderId
 * @param {number} opts.partnerProviderId
 */
function computePartnershipSplit({
  items = [],
  commissionMode = 'included',
  commissionRatePercent,
  leadSharePercent,
  leadProviderId,
  partnerProviderId,
} = {}) {
  const mode = normalizeCommissionMode(commissionMode);
  const financials = computeOfferFinancials(items, mode, commissionRatePercent);
  const share = clampLeadSharePercent(leadSharePercent);
  const leadId = Number(leadProviderId);
  const partnerId = Number(partnerProviderId);

  const lineItems = Array.isArray(items) ? items : [];
  const hasLineOwners = lineItems.some((item) => item?.owner_provider_id != null && item.owner_provider_id !== '');

  let leadNet;
  let partnerNet;
  let splitBasis = 'percent';

  if (hasLineOwners && financials.subtotal > 0) {
    splitBasis = 'lines';
    let leadSub = 0;
    let partnerSub = 0;
    for (const item of lineItems) {
      const amt = lineAmount(item);
      const owner = Number(item.owner_provider_id);
      if (owner === partnerId) partnerSub += amt;
      else leadSub += amt;
    }
    const owned = leadSub + partnerSub;
    const leadRatio = owned > 0 ? leadSub / owned : share / 100;
    leadNet = roundMoney2(financials.providerNet * leadRatio);
    partnerNet = roundMoney2(financials.providerNet - leadNet);
  } else {
    leadNet = roundMoney2(financials.providerNet * (share / 100));
    partnerNet = roundMoney2(financials.providerNet - leadNet);
  }

  return {
    lead_provider_id: Number.isFinite(leadId) ? leadId : null,
    partner_provider_id: Number.isFinite(partnerId) ? partnerId : null,
    lead_share_percent: share,
    lead_net: leadNet,
    partner_net: partnerNet,
    commission_amount: financials.commissionAmount,
    client_total: financials.clientTotal,
    provider_net: financials.providerNet,
    subtotal: financials.subtotal,
    split_basis: splitBasis,
    payouts_enabled: Boolean(PARTNERSHIP_SPLIT_PAYOUTS_ENABLED),
    payouts_executed: false,
  };
}

/**
 * Never moves money. Partnership nets are settled later as in-app bank-transfer
 * orders (one per beneficiary), not by Stripe Connect or a transfer API.
 */
function executePartnershipPayouts(split) {
  if (!PARTNERSHIP_SPLIT_PAYOUTS_ENABLED) {
    return {
      executed: false,
      reason: 'PARTNERSHIP_SPLIT_PAYOUTS_ENABLED is false',
      split: split ? { ...split, payouts_executed: false, payouts_enabled: false } : split,
    };
  }
  return {
    executed: false,
    reason: 'payout_rail_not_ready',
    split: split ? { ...split, payouts_executed: false, payouts_enabled: true } : split,
  };
}

function isPartnershipLive(row, now = new Date()) {
  if (!row || String(row.status) !== 'accepted') return false;
  const t = now instanceof Date ? now : new Date(now);
  if (row.starts_at && new Date(row.starts_at) > t) return false;
  if (row.ends_at && new Date(row.ends_at) <= t) return false;
  const leadStatus = row.lead_status != null ? String(row.lead_status) : 'active';
  const partnerStatus = row.partner_status != null ? String(row.partner_status) : 'active';
  if (leadStatus && leadStatus !== 'active') return false;
  if (partnerStatus && partnerStatus !== 'active') return false;
  return true;
}

function effectivePartnershipStatus(row, now = new Date()) {
  if (!row) return null;
  if (row.status === 'accepted' && row.ends_at && new Date(row.ends_at) <= (now instanceof Date ? now : new Date(now))) {
    return 'expired';
  }
  return row.status;
}

function buildComboPayloadFromPartnership(partnership) {
  if (!partnership) return null;
  const leadId = Number(partnership.lead_provider_id);
  const partnerId = Number(partnership.partner_provider_id);
  if (!leadId || !partnerId) return null;
  const title = partnership.combo_title || partnership.lead_display_name || '';
  return {
    partnership_id: Number(partnership.id) || null,
    primary_provider_id: leadId,
    lines: [
      { provider_id: leadId, role: 'lead', note: title || null },
      { provider_id: partnerId, role: 'partner', note: title || null },
    ],
  };
}

function canModifyCombo(callerProviderId, partnership) {
  return Number(callerProviderId) === Number(partnership?.lead_provider_id);
}

module.exports = {
  DEFAULT_LEAD_SHARE,
  clampLeadSharePercent,
  computePartnershipSplit,
  executePartnershipPayouts,
  isPartnershipLive,
  effectivePartnershipStatus,
  buildComboPayloadFromPartnership,
  canModifyCombo,
};
