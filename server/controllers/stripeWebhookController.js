const { STRIPE_WEBHOOK_SECRET, QUIET_LOGS } = require('../../constants/constant');
const { getStripe } = require('../utils/stripeClient');
const { markPaymentPaid } = require('../services/paymentPostProcessService');
const Payment = require('../models/Payment');
const { sendPaymentConfirmationEmail } = require('../services/paymentConfirmationEmail');
const DOCUMENTED_WEBHOOK_TYPES = require('../constants/stripeWebhookEventTypes');

function objectId(obj) {
  return obj && typeof obj === 'object' && obj.id != null ? String(obj.id) : '';
}

async function handleCheckoutSessionPaid(session) {
  const paymentId = session.metadata?.payment_id;
  const requestId = session.metadata?.request_id;
  if (!paymentId || !requestId) {
    console.warn('[Stripe webhook] missing metadata on session', session.id);
    return;
  }

  const result = await markPaymentPaid(paymentId, { payment_method: 'card', fromWebhook: true });
  if (!result.ok && result.code !== 400) {
    console.error('[Stripe webhook] markPaymentPaid failed', result);
    return;
  }
  await recordStripeFee(session, paymentId);
  if (result.ok) {
    await sendPaymentConfirmationEmail(paymentId).catch((e) =>
      console.error('[Stripe webhook] confirmation email:', e.message)
    );
  }
}

/** Persist the Stripe processing fee from the charge balance transaction. */
async function recordStripeFee(session, paymentId) {
  const stripe = getStripe();
  const piRef = session.payment_intent;
  const piId = typeof piRef === 'string' ? piRef : piRef?.id;
  if (!stripe || !piId) return;
  try {
    const pi = await stripe.paymentIntents.retrieve(piId, {
      expand: ['latest_charge.balance_transaction'],
    });
    const charge = pi.latest_charge;
    const txn = charge && typeof charge === 'object' ? charge.balance_transaction : null;
    if (!txn || typeof txn !== 'object' || txn.fee == null) return;
    const fee = Math.round(Number(txn.fee)) / 100;
    if (!Number.isFinite(fee)) return;
    await Payment.update(paymentId, { stripe_fee_amount: fee });
  } catch (err) {
    console.warn('[Stripe webhook] fee lookup failed', err.message);
  }
}

function logWebhookEvent(event) {
  if (QUIET_LOGS) return;
  const id = objectId(event.data?.object);
  console.log(`[Stripe webhook] ${event.type}${id ? ` ${id}` : ''}`);
}

/** Shared signature-verify + dispatch, parameterized by which secret/handler applies. */
async function verifyAndDispatch(req, res, { secret, label, dispatch }) {
  const stripe = getStripe();
  if (!stripe || !secret) {
    return res.status(503).json({ error: `Stripe webhook not configured (${label})` });
  }

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error(`[Stripe webhook:${label}] signature:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await dispatch(event);
    return res.json({ received: true });
  } catch (err) {
    console.error(`[Stripe webhook:${label}]`, err);
    return res.status(500).json({ error: err.message });
  }
}

/** POST /api/stripe/webhook — platform account (checkout, payments). */
exports.handle = (req, res) =>
  verifyAndDispatch(req, res, {
    secret: STRIPE_WEBHOOK_SECRET,
    label: 'account',
    dispatch: async (event) => {
      switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          await handleCheckoutSessionPaid(event.data.object);
          break;

        case 'checkout.session.async_payment_failed':
          console.warn(
            '[Stripe webhook] checkout.session.async_payment_failed',
            objectId(event.data.object) || event.data.object?.id
          );
          break;

        default:
          if (DOCUMENTED_WEBHOOK_TYPES.has(event.type)) {
            logWebhookEvent(event);
          } else {
            console.log('[Stripe webhook] event (add to stripeWebhookEventTypes if standard):', event.type);
          }
      }
    },
  });
