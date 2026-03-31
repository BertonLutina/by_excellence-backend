const Payment = require('../models/Payment');
const ServiceRequest = require('../models/ServiceRequest');
const Offer = require('../models/Offer');
const paymentCommissionService = require('./paymentCommissionService');

function mysqlDateTime(iso) {
  if (!iso) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  const s = String(iso);
  return s.includes('T') ? s.slice(0, 19).replace('T', ' ') : s;
}

async function updateServiceRequestStatusAfterPayment(payment, request, { fromWebhook }) {
  if (!request) return;
  const rid = request.id;
  if (payment.type === 'deposit') {
    await ServiceRequest.update(rid, { status: 'deposit_paid' });
  } else if (payment.type === 'final') {
    await ServiceRequest.update(rid, { status: 'completed' });
  } else if (payment.type === 'installment') {
    if (fromWebhook) {
      const idx = Number(payment.installment_index);
      const total = Number(payment.installment_total);
      if (idx === total && total > 0) {
        await ServiceRequest.update(rid, { status: 'completed' });
      }
    } else {
      const all = await Payment.findAll({ filters: { request_id: rid }, limit: 200 });
      const installments = all.filter((p) => p.type === 'installment');
      const allPaid = installments.every(
        (p) => Number(p.id) === Number(payment.id) || p.status === 'paid'
      );
      if (allPaid) {
        await ServiceRequest.update(rid, { status: 'completed' });
      } else if (
        !['deposit_paid', 'date_confirmed', 'final_payment_pending'].includes(request.status)
      ) {
        await ServiceRequest.update(rid, { status: 'deposit_paid' });
      }
    }
  }
}

async function ensureFinalPaymentAfterDeposit(payment) {
  if (!payment.offer_id) return;

  const offer = await Offer.findById(payment.offer_id);
  if (!offer) return;

  /** Admin approved paiement en N fois : les tranches couvrent le solde, pas de ligne "final". */
  if (offer.installment_status === 'approved') return;

  const installmentRows = await Payment.findAll({
    filters: { offer_id: payment.offer_id, type: 'installment' },
    limit: 50,
  });
  if (installmentRows.length > 0) return;

  const existing = await Payment.findAll({
    filters: { request_id: payment.request_id, type: 'final' },
    limit: 20,
  });
  if (existing.length > 0) return;

  const finalAmount = Number(offer.total_amount || 0) - Number(offer.deposit_amount || 0);
  if (!(finalAmount > 0)) return;

  await Payment.create({
    request_id: payment.request_id,
    offer_id: payment.offer_id,
    type: 'final',
    amount: finalAmount,
    status: 'pending',
  });
}

/**
 * Mark a pending payment as paid, apply commission snapshot, update request, create final after deposit.
 * @param {number|string} paymentId
 * @param {{ payment_method?: string, fromWebhook?: boolean }} options
 */
async function markPaymentPaid(paymentId, options = {}) {
  const payment = await Payment.findById(paymentId);
  if (!payment) return { ok: false, code: 404, error: 'Payment not found' };
  if (payment.status !== 'pending') {
    return { ok: false, code: 400, error: 'Payment already processed' };
  }

  const commission = await paymentCommissionService.commissionFieldsForPaidTransition(payment);
  const paidDate = mysqlDateTime(new Date().toISOString());

  await Payment.update(paymentId, {
    status: 'paid',
    paid_date: paidDate,
    payment_method: options.payment_method || 'card',
    commission_rate_percent: commission.commission_rate_percent,
    admin_commission_amount: commission.admin_commission_amount,
    provider_net_amount: commission.provider_net_amount,
  });

  const fresh = await Payment.findById(paymentId);
  const request = await ServiceRequest.findById(fresh.request_id);

  await updateServiceRequestStatusAfterPayment(fresh, request, {
    fromWebhook: Boolean(options.fromWebhook),
  });

  if (fresh.type === 'deposit') {
    await ensureFinalPaymentAfterDeposit(fresh);
  }

  return { ok: true, payment: fresh, request };
}

module.exports = {
  markPaymentPaid,
  updateServiceRequestStatusAfterPayment,
  ensureFinalPaymentAfterDeposit,
};
