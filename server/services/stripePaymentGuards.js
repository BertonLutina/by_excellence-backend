const Payment = require('../models/Payment');

const MIN_AMOUNT_EUR = 0.5;

/**
 * @param {import('../models/Payment')} payment
 * @returns {string|null} error message or null if OK
 */
function validateStripeAmount(payment) {
  const n = Number(payment?.amount);
  if (!Number.isFinite(n) || n < MIN_AMOUNT_EUR) {
    return `Montant minimum pour Stripe : ${MIN_AMOUNT_EUR}€ (montant de l’offre ou de la tranche).`;
  }
  return null;
}

/**
 * Enforce same order as ClientRequestDetail: deposit before final / tranches; tranche N-1 before N.
 * @param {import('../models/Payment')} payment
 * @returns {Promise<string|null>}
 */
async function assertPaymentOrderForCheckout(payment) {
  const rid = payment.request_id;

  if (payment.type === 'final') {
    const deposits = await Payment.findAll({ filters: { request_id: rid, type: 'deposit' }, limit: 20 });
    const depPaid = deposits.some((d) => d.status === 'paid');
    if (!depPaid) return "L'acompte doit être réglé avant le solde.";
    return null;
  }

  if (payment.type === 'installment') {
    const deposits = await Payment.findAll({ filters: { request_id: rid, type: 'deposit' }, limit: 20 });
    const depPaid = deposits.some((d) => d.status === 'paid');
    if (!depPaid) return "L'acompte doit être réglé avant les tranches.";

    const idx = Number(payment.installment_index);
    if (idx > 1) {
      const allInst = await Payment.findAll({
        filters: { request_id: rid, type: 'installment' },
        limit: 50,
      });
      const prev = allInst.find((p) => Number(p.installment_index) === idx - 1);
      if (!prev || prev.status !== 'paid') {
        return 'Réglez la tranche précédente avant celle-ci.';
      }
    }
    return null;
  }

  return null;
}

module.exports = {
  validateStripeAmount,
  assertPaymentOrderForCheckout,
  MIN_AMOUNT_EUR,
};
