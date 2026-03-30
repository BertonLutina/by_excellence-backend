const Payment = require('../models/Payment');
const ServiceRequest = require('../models/ServiceRequest');
const { sendMail } = require('../utils/mailer');
const { FRONTEND_ORIGIN } = require('../../constants/constant');

/**
 * @param {{ days_before?: number, days_after?: number }} body
 */
async function sendPaymentReminders(body = {}) {
  const reminderDaysBefore = body.days_before ?? 3;
  const reminderDaysAfter = body.days_after ?? 1;

  const pendingPayments = await Payment.findAll({ filters: { status: 'pending' }, limit: 500 });
  if (pendingPayments.length === 0) {
    return {
      success: true,
      reminders_sent: 0,
      details: [],
      config: { days_before: reminderDaysBefore, days_after: reminderDaysAfter },
      message: 'Aucun paiement en attente',
    };
  }

  const now = new Date();
  let remindersSent = 0;
  const results = [];

  const byRequest = {};
  for (const p of pendingPayments) {
    if (!byRequest[p.request_id]) byRequest[p.request_id] = [];
    byRequest[p.request_id].push(p);
  }

  const appBase = FRONTEND_ORIGIN.replace(/\/$/, '');

  for (const [requestId, payments] of Object.entries(byRequest)) {
    const request = await ServiceRequest.findById(requestId);
    if (!request || !request.client_email) continue;
    if (['completed', 'cancelled'].includes(request.status)) continue;

    for (const payment of payments) {
      let dueDate = null;
      const eventDate = request.confirmed_date || request.preferred_date;
      if (eventDate) {
        const event = new Date(eventDate);
        if (payment.type === 'deposit') {
          dueDate = new Date(payment.created_at || Date.now());
          dueDate.setDate(dueDate.getDate() + 3);
        } else if (payment.type === 'final') {
          dueDate = new Date(event);
          dueDate.setDate(dueDate.getDate() - 7);
        } else if (payment.type === 'installment') {
          dueDate = new Date(payment.created_at || Date.now());
          dueDate.setDate(dueDate.getDate() + 30 * (Number(payment.installment_index) || 1));
        }
      }

      if (!dueDate) continue;

      const diffDays = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));
      let reminderType = null;
      let urgencyLabel = '';

      if (diffDays === reminderDaysBefore) {
        reminderType = 'upcoming';
        urgencyLabel = `dans ${reminderDaysBefore} jour${reminderDaysBefore > 1 ? 's' : ''}`;
      } else if (diffDays === -reminderDaysAfter) {
        reminderType = 'overdue';
        urgencyLabel = `en retard de ${reminderDaysAfter} jour${reminderDaysAfter > 1 ? 's' : ''}`;
      }

      if (!reminderType) continue;

      const paymentTypeLabel =
        payment.type === 'deposit'
          ? 'acompte'
          : payment.type === 'final'
            ? 'solde final'
            : `tranche ${payment.installment_index}/${payment.installment_total}`;

      const subject =
        reminderType === 'overdue'
          ? `⚠️ Paiement en retard : ${paymentTypeLabel} de ${payment.amount}€`
          : `⏰ Rappel : ${paymentTypeLabel} de ${payment.amount}€ à régler`;

      const urgencyColor = reminderType === 'overdue' ? '#dc2626' : '#d97706';
      const urgencyBg = reminderType === 'overdue' ? '#fee2e2' : '#fef3c7';

      const bodyHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #3d4263; padding: 24px; text-align: center;">
              <h1 style="color: #d4a848; margin: 0; font-size: 24px;">By Excellence</h1>
              <p style="color: #ffffff80; margin: 4px 0 0; font-size: 13px;">African Services</p>
            </div>
            <div style="padding: 30px; background: #ffffff; line-height: 1.7; color: #333; font-size: 15px;">
              <p>Bonjour <strong>${request.client_name || ''}</strong>,</p>
              <div style="background: ${urgencyBg}; border-left: 4px solid ${urgencyColor}; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: ${urgencyColor}; font-weight: bold;">
                  ${reminderType === 'overdue' ? '⚠️ Paiement en retard' : '⏰ Rappel de paiement'}
                </p>
                <p style="margin: 4px 0 0; color: #555;">
                  Votre <strong>${paymentTypeLabel}</strong> de <strong>${payment.amount}€</strong>
                  pour votre prestation avec <strong>${request.provider_name}</strong> est <strong>${urgencyLabel}</strong>.
                </p>
              </div>
              <p>Connectez-vous à votre espace client pour effectuer ce paiement :</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${appBase}/ClientRequestDetail?id=${requestId}"
                   style="background: #d4a848; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                  Effectuer le paiement
                </a>
              </div>
              <p style="color: #888; font-size: 13px;">
                Si vous avez déjà effectué ce paiement, veuillez ignorer ce message.
              </p>
            </div>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #999;">
              Rappel automatique de By Excellence African Services
            </div>
          </div>
        `;

      await sendMail({
        to: request.client_email,
        subject: `[By Excellence] ${subject}`,
        html: bodyHtml,
      });

      remindersSent++;
      results.push({
        request_id: requestId,
        client_email: request.client_email,
        payment_type: payment.type,
        amount: payment.amount,
        reminder_type: reminderType,
        urgency: urgencyLabel,
      });
    }
  }

  return {
    success: true,
    reminders_sent: remindersSent,
    details: results,
    config: { days_before: reminderDaysBefore, days_after: reminderDaysAfter },
  };
}

module.exports = { sendPaymentReminders };
