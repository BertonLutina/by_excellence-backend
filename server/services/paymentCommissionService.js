const { executeSQL } = require('../db/db');
const commission = require('../utils/commission');

function firstRow(result) {
  const rows = Array.isArray(result) ? result : result ? [result] : [];
  return rows[0] || null;
}

/**
 * Load provider row (tier + premium rate) for a payment via its offer.
 * @param {{ offer_id: number }} payment
 */
async function loadProviderForPayment(payment) {
  if (!payment?.offer_id) return null;
  const offer = firstRow(await executeSQL('SELECT provider_id FROM offers WHERE id = ?', [payment.offer_id]));
  if (!offer) return null;
  const provider = firstRow(
    await executeSQL(
      'SELECT id, provider_tier, premium_commission_percent FROM providers WHERE id = ?',
      [offer.provider_id]
    )
  );
  return provider;
}

/**
 * Compute commission snapshot for a payment row (does not persist).
 * @param {{ amount: number|string, offer_id: number }} payment
 */
async function computeBreakdownForPayment(payment) {
  const provider = await loadProviderForPayment(payment);
  return commission.computePaymentBreakdown(payment.amount, provider || {});
}

/**
 * Fields to merge into payment update when status becomes paid.
 * @param {import('../models/Payment')} existingPayment
 */
async function commissionFieldsForPaidTransition(existingPayment) {
  const breakdown = await computeBreakdownForPayment(existingPayment);
  return breakdown;
}

module.exports = {
  loadProviderForPayment,
  computeBreakdownForPayment,
  commissionFieldsForPaidTransition,
};
