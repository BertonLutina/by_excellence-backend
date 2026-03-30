const { FRONTEND_ORIGIN } = require('../../constants/constant');
const { getStripe, isTestStripeKey } = require('../utils/stripeClient');
const Payment = require('../models/Payment');
const ServiceRequest = require('../models/ServiceRequest');
const paymentCommissionService = require('../services/paymentCommissionService');
const { markPaymentPaid } = require('../services/paymentPostProcessService');
const { sendPaymentConfirmationEmail } = require('../services/paymentConfirmationEmail');
const { sendPaymentReminders } = require('../services/paymentRemindersService');
const { sendStatusNotification } = require('../services/statusNotificationService');
const { generateInvoicePdfForPayment } = require('../services/invoicePdfService');
const Offer = require('../models/Offer');
const { buildStripeProductName, buildStripeProductDescription, isComboRequest } = require('../utils/stripeProductCopy');
const {
  validateStripeAmount,
  assertPaymentOrderForCheckout,
} = require('../services/stripePaymentGuards');

function clientBaseUrl(req) {
  const h = req.headers.referer || req.headers.origin;
  if (h) {
    try {
      const u = new URL(h);
      return `${u.origin}`;
    } catch {
      return String(h).replace(/\/+$/, '').split('?')[0];
    }
  }
  return FRONTEND_ORIGIN.replace(/\/$/, '');
}

async function findCheckoutSessionByPaymentMetadata(stripe, paymentId) {
  let starting_after;
  for (let i = 0; i < 15; i++) {
    const page = await stripe.checkout.sessions.list({ limit: 100, starting_after });
    const hit = page.data.find((s) => String(s.metadata?.payment_id) === String(paymentId));
    if (hit) return hit;
    if (!page.has_more || !page.data.length) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return null;
}

exports.invoke = async (req, res) => {
  const fnName = req.body?.name;
  try {
    const { name, params = {} } = req.body;
    if (!name) return res.status(400).json({ error: 'Function name required' });

    const requireAdmin = () => {
      if (req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
        return false;
      }
      return true;
    };

    switch (name) {
      case 'generateInvoicePDF': {
        const { payment_id } = params;
        if (!payment_id) return res.status(400).json({ error: 'payment_id required' });
        const out = await generateInvoicePdfForPayment(payment_id, { user: req.user });
        if (!out.ok) return res.status(out.code || 500).json({ error: out.error });
        return res.json({ url: out.url, success: true });
      }

      case 'sendPaymentReminders': {
        if (!requireAdmin()) return;
        const data = await sendPaymentReminders(params);
        return res.json({ data });
      }

      case 'createStripePayment': {
        const { payment_id } = params;
        if (!payment_id) return res.status(400).json({ error: 'payment_id required' });

        const payment = await Payment.findById(payment_id);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (payment.status !== 'pending') {
          return res.status(400).json({ error: 'Payment already processed' });
        }

        const request = await ServiceRequest.findById(payment.request_id);
        if (!request) return res.status(404).json({ error: 'Request not found' });

        const amountErr = validateStripeAmount(payment);
        if (amountErr) return res.status(400).json({ error: amountErr });

        const orderErr = await assertPaymentOrderForCheckout(payment);
        if (orderErr) return res.status(400).json({ error: orderErr });

        const offer = payment.offer_id ? await Offer.findById(payment.offer_id) : null;

        let commissionBreakdown;
        try {
          commissionBreakdown = await paymentCommissionService.computeBreakdownForPayment(payment);
        } catch (e) {
          return res.status(400).json({ error: e.message || 'Commission calculation failed' });
        }

        const baseUrl = clientBaseUrl(req);
        const successUrl = `${baseUrl}/ClientRequestDetail?id=${request.id}&payment_success=true`;
        const cancelUrl = `${baseUrl}/ClientRequestDetail?id=${request.id}&payment_cancelled=true`;
        const amountNum = Number(payment.amount);
        const feeCents = Math.round(commissionBreakdown.admin_commission_amount * 100);

        const stripe = getStripe();
        const useInstantPay = !stripe || isTestStripeKey();

        if (useInstantPay) {
          const result = await markPaymentPaid(payment_id, { payment_method: 'card', fromWebhook: false });
          if (!result.ok) {
            return res.status(result.code || 400).json({ error: result.error || 'Payment update failed' });
          }
          await sendPaymentConfirmationEmail(payment_id).catch((e) =>
            console.error('[createStripePayment] confirmation email:', e.message)
          );
          return res.json({
            data: {
              sessionUrl: successUrl,
              amount: amountNum,
              commission: commissionBreakdown,
              stripe_application_fee_amount: feeCents,
              stripe_transfer_amount: Math.round(commissionBreakdown.provider_net_amount * 100),
            },
          });
        }

        const productName = buildStripeProductName(payment, request, offer);
        const productDescription = buildStripeProductDescription(payment, request, offer);

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'eur',
                product_data: {
                  name: productName,
                  description: productDescription || undefined,
                },
                unit_amount: Math.round(amountNum * 100),
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: (() => {
            const meta = {
              payment_id: String(payment.id),
              request_id: String(request.id),
              payment_type: String(payment.type || 'unknown'),
            };
            if (req.user?.email) meta.client_email = String(req.user.email).slice(0, 500);
            if (payment.offer_id != null) meta.offer_id = String(payment.offer_id);
            if (isComboRequest(request)) meta.is_combo = '1';
            if (payment.type === 'installment') {
              if (payment.installment_index != null) meta.installment_index = String(payment.installment_index);
              if (payment.installment_total != null) meta.installment_total = String(payment.installment_total);
            }
            return meta;
          })(),
        });

        return res.json({
          data: {
            sessionUrl: session.url,
            amount: amountNum,
            commission: commissionBreakdown,
            stripe_application_fee_amount: feeCents,
            stripe_transfer_amount: Math.round(commissionBreakdown.provider_net_amount * 100),
          },
        });
      }

      case 'processRefund': {
        if (!requireAdmin()) return;
        const { payment_id, amount, reason } = params;
        if (!payment_id) return res.status(400).json({ error: 'payment_id required' });

        const payment = await Payment.findById(payment_id);
        if (!payment || payment.status !== 'paid') {
          return res.status(404).json({ error: 'Payment not found or not paid' });
        }

        const stripe = getStripe();
        if (!stripe) {
          return res.status(503).json({ error: 'Stripe is not configured' });
        }

        const session = await findCheckoutSessionByPaymentMetadata(stripe, payment_id);
        if (!session || !session.payment_intent) {
          return res.status(404).json({ error: 'Stripe session not found for this payment' });
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
        const refund = await stripe.refunds.create({
          payment_intent: paymentIntent.id,
          amount: amount != null && amount !== '' ? Math.round(Number(amount) * 100) : undefined,
          reason: reason || 'requested_by_customer',
        });

        const fullRefund = refund.amount === paymentIntent.amount;
        await Payment.update(payment_id, { status: fullRefund ? 'refunded' : 'paid' });

        const sr = await ServiceRequest.findById(payment.request_id);
        if (sr?.client_email) {
          const { sendMail } = require('../utils/mailer');
          await sendMail({
            to: sr.client_email,
            subject: 'Remboursement effectué',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #0a0a5c;">Remboursement confirmé</h2>
                    <p>Bonjour ${sr.client_name || ''},</p>
                    <p>Un remboursement de <strong>${(refund.amount / 100).toFixed(2)}€</strong> a été effectué sur votre moyen de paiement.</p>
                    <p>Le montant apparaîtra sur votre compte sous 5-10 jours ouvrés.</p>
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                        L'équipe By Excellence
                    </p>
                </div>
            `,
          }).catch((e) => console.error('[processRefund] mail:', e.message));
        }

        return res.json({
          success: true,
          refund_id: refund.id,
          amount: refund.amount / 100,
        });
      }

      case 'sendStatusNotification': {
        if (!requireAdmin()) return;
        const out = await sendStatusNotification(params);
        if (!out.ok) return res.status(out.code || 500).json({ error: out.error });
        return res.json(out);
      }

      case 'sendPaymentConfirmationEmail': {
        if (!requireAdmin()) return;
        const { payment_id } = params;
        if (!payment_id) return res.status(400).json({ error: 'payment_id required' });
        const out = await sendPaymentConfirmationEmail(payment_id);
        if (!out.ok) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
      }

      default:
        return res.status(404).json({ error: `Unknown function: ${name}` });
    }
  } catch (err) {
    console.error('[functions.invoke]', fnName, err);
    res.status(500).json({ error: err.message });
  }
};
