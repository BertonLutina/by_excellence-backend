const commission = require('./commission');

function roundMoney2(value) {
  return Math.round(Number(value) * 100) / 100;
}

/**
 * @param {Array<{ price?: number|string, unit_price?: number|string, quantity?: number|string }>} items
 * @param {'included'|'on_top'} commissionMode
 * @param {number} commissionRatePercent
 */
function computeOfferFinancials(items, commissionMode = 'included', commissionRatePercent = 15) {
  const subtotal = roundMoney2(
    (items || []).reduce((s, i) => s + lineAmount(i), 0)
  );
  const rate = Number(commissionRatePercent) || 0;

  if (commissionMode === 'on_top') {
    const commissionAmount = roundMoney2((subtotal * rate) / 100);
    const clientTotal = roundMoney2(subtotal + commissionAmount);
    return {
      subtotal,
      commissionAmount,
      clientTotal,
      providerNet: subtotal,
      commissionRatePercent: rate,
    };
  }

  const clientTotal = subtotal;
  const commissionAmount = roundMoney2((clientTotal * rate) / 100);
  const providerNet = roundMoney2(clientTotal - commissionAmount);
  return {
    subtotal,
    commissionAmount,
    clientTotal,
    providerNet,
    commissionRatePercent: rate,
  };
}

function lineAmount(item) {
  const unit = item?.unit_price != null ? Number(item.unit_price) : Number(item?.price);
  const quantity = Math.max(1, Number(item?.quantity) || 1);
  return (Number.isFinite(unit) ? unit : 0) * quantity;
}

function normalizeCommissionMode(mode) {
  return mode === 'on_top' ? 'on_top' : 'included';
}

function parseItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function resolvePaymentFlow(items) {
  if (!Array.isArray(items) || items.length === 0) return 'deposit_flow';
  return items.every((item) => item?.item_type === 'good')
    ? 'direct_full_payment'
    : 'deposit_flow';
}

/**
 * Recompute total_amount / deposit_amount from line items + commission mode.
 * @param {object} body
 * @param {{ provider_tier?: string, premium_commission_percent?: number }} provider
 */
function applyOfferFinancials(body, provider) {
  const items = parseItems(body.items);
  const mode = normalizeCommissionMode(body.commission_mode);
  const rate = commission.getEffectiveCommissionPercent(provider || {});
  const { clientTotal } = computeOfferFinancials(items, mode, rate);
  const depositPct = Number(body.deposit_percentage);
  const depositAmount = roundMoney2(
    clientTotal * ((Number.isFinite(depositPct) ? depositPct : 30) / 100)
  );

  return {
    ...body,
    items,
    commission_mode: mode,
    payment_flow: resolvePaymentFlow(items),
    total_amount: clientTotal,
    deposit_amount: depositAmount,
  };
}

module.exports = {
  computeOfferFinancials,
  normalizeCommissionMode,
  resolvePaymentFlow,
  applyOfferFinancials,
};
