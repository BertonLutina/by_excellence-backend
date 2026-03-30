const Payment = require('../models/Payment');
const ServiceRequest = require('../models/ServiceRequest');
const { sendMail } = require('../utils/mailer');
const { FRONTEND_ORIGIN } = require('../../constants/constant');

function paymentEmailCopy(payment) {
  if (payment.type === 'deposit') {
    return {
      paymentType: 'Acompte',
      icon: '💰',
      receivedPhrase: 'acompte',
      extraHtml: `<p>Votre réservation est maintenant confirmée ! Le prestataire va vous contacter prochainement pour finaliser les détails.</p>`,
    };
  }
  if (payment.type === 'installment') {
    const idx = Number(payment.installment_index);
    const total = Number(payment.installment_total);
    const isLast = idx === total && total > 0;
    return {
      paymentType: isLast ? 'Dernière tranche' : `Tranche ${idx}/${total}`,
      icon: '💳',
      receivedPhrase: isLast ? 'dernier versement' : `tranche ${idx}/${total}`,
      extraHtml: isLast
        ? `<p>Merci : vous avez réglé l’ensemble de votre prestation. Nous espérons que tout se passera au mieux le jour J !</p>
           <p>N'hésitez pas à laisser un avis pour aider d'autres clients.</p>`
        : `<p>Merci pour ce versement. La prochaine échéance est disponible dans votre espace client lorsque vous le souhaitez.</p>`,
    };
  }
  return {
    paymentType: 'Paiement final',
    icon: '✅',
    receivedPhrase: 'paiement final',
    extraHtml: `<p>Votre prestation est terminée. Nous espérons que tout s'est bien passé !</p>
                <p>N'hésitez pas à laisser un avis pour aider d'autres clients.</p>`,
  };
}

/**
 * @param {number|string} paymentId
 */
async function sendPaymentConfirmationEmail(paymentId) {
  const payment = await Payment.findById(paymentId);
  if (!payment) return { ok: false, error: 'Payment not found' };

  const request = await ServiceRequest.findById(payment.request_id);
  if (!request || !request.client_email) return { ok: false, error: 'Request or client email missing' };

  const { paymentType, icon, receivedPhrase, extraHtml } = paymentEmailCopy(payment);
  const detailUrl = `${FRONTEND_ORIGIN.replace(/\/$/, '')}/ClientRequestDetail?id=${request.id}`;

  await sendMail({
    to: request.client_email,
    subject: `${icon} ${paymentType} confirmé`,
    html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #0a0a5c;">${paymentType} bien reçu !</h2>
                    <p>Bonjour ${request.client_name || ''},</p>
                    <p>Nous confirmons la réception de votre ${receivedPhrase}.</p>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="color: #0a0a5c; margin-top: 0;">Détails du paiement</h3>
                        <p><strong>Prestataire :</strong> ${request.provider_name || ''}</p>
                        <p><strong>Montant :</strong> ${payment.amount}€</p>
                        <p><strong>Type :</strong> ${paymentType}</p>
                        ${
                          request.confirmed_date
                            ? `<p><strong>Date de prestation :</strong> ${new Date(
                                request.confirmed_date
                              ).toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}</p>`
                            : ''
                        }
                    </div>
                    ${extraHtml}
                    <p style="margin-top: 30px;">
                        <a href="${detailUrl}"
                           style="background: #ffe342; color: #0a0a5c; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Voir les détails
                        </a>
                    </p>
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        L'équipe By Excellence<br>
                        Un service de qualité et de distinction.
                    </p>
                </div>
            `,
  });

  return { ok: true };
}

module.exports = { sendPaymentConfirmationEmail };
