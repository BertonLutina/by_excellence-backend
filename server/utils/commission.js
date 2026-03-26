/**
 * Platform commission rules (admin share when a client pays a provider).
 * - Standard tier (and unclassified / non-premium): COMMISSION_STANDARD_PERCENT (default 15%).
 * - Premium tier: COMMISSION_PREMIUM_DEFAULT_PERCENT (default 20%) or provider.premium_commission_percent (20 or 30).
 */
const {
  COMMISSION_STANDARD_PERCENT,
  COMMISSION_PREMIUM_DEFAULT_PERCENT,
} = require('../config/constant');

const STANDARD_DEFAULT = 15;
const PREMIUM_DEFAULT = 20;

function standardPercent() {
  const n = Number(COMMISSION_STANDARD_PERCENT);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : STANDARD_DEFAULT;
}

function premiumDefaultPercent() {
  const n = Number(COMMISSION_PREMIUM_DEFAULT_PERCENT);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : PREMIUM_DEFAULT;
}

/**
 * @param {{ provider_tier?: string | null, premium_commission_percent?: number | string | null }} provider
 * @returns {number} percentage 0–100
 */
function getEffectiveCommissionPercent(provider) {
  const tier = provider?.provider_tier;
  if (tier === 'premium') {
    const p = provider?.premium_commission_percent;
    if (p == null || p === '') return premiumDefaultPercent();
    const n = Number(p);
    if (n === 30) return 30;
    return 20;
  }
  return standardPercent();
}

function roundMoney2(value) {
  return Math.round(Number(value) * 100) / 100;
}

/**
 * @param {number|string} amountGross
 * @param {{ provider_tier?: string | null, premium_commission_percent?: number | string | null }} provider
 */
function computePaymentBreakdown(amountGross, provider) {
  const amount = Number(amountGross);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Invalid payment amount');
  }
  const rate = getEffectiveCommissionPercent(provider);
  const admin_commission_amount = roundMoney2((amount * rate) / 100);
  const provider_net_amount = roundMoney2(amount - admin_commission_amount);
  return {
    commission_rate_percent: rate,
    admin_commission_amount,
    provider_net_amount,
  };
}

function isValidPremiumCommissionPercent(value) {
  const n = Number(value);
  return n === 20 || n === 30;
}

module.exports = {
  getEffectiveCommissionPercent,
  computePaymentBreakdown,
  isValidPremiumCommissionPercent,
  standardPercent,
  premiumDefaultPercent,
};
