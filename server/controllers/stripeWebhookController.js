const { STRIPE_WEBHOOK_SECRET, QUIET_LOGS } = require('../../constants/constant');
const { getStripe } = require('../utils/stripeClient');
const { markPaymentPaid } = require('../services/paymentPostProcessService');
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
  } else if (result.ok) {
    await sendPaymentConfirmationEmail(paymentId).catch((e) =>
      console.error('[Stripe webhook] confirmation email:', e.message)
    );
  }
}

function logWebhookEvent(event) {
  if (QUIET_LOGS) return;
  const id = objectId(event.data?.object);
  console.log(`[Stripe webhook] ${event.type}${id ? ` ${id}` : ''}`);
}

exports.handle = async (req, res) => {
  const stripe = getStripe();
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe webhook not configured' });
  }

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe webhook] signature:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
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

    return res.json({ received: true });
  } catch (err) {
    console.error('[Stripe webhook]', err);
    return res.status(500).json({ error: err.message });
  }
};
