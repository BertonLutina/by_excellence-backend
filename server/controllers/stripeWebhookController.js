const { STRIPE_WEBHOOK_SECRET } = require('../../constants/constant');
const { getStripe } = require('../utils/stripeClient');
const { markPaymentPaid } = require('../services/paymentPostProcessService');
const { sendPaymentConfirmationEmail } = require('../services/paymentConfirmationEmail');

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
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const paymentId = session.metadata?.payment_id;
      const requestId = session.metadata?.request_id;
      if (!paymentId || !requestId) {
        console.warn('[Stripe webhook] missing metadata on session', session.id);
        return res.json({ received: true });
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
    return res.json({ received: true });
  } catch (err) {
    console.error('[Stripe webhook]', err);
    return res.status(500).json({ error: err.message });
  }
};
