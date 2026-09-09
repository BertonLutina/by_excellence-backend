const { STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET, QUIET_LOGS } = require('../../constants/constant');
const { getStripe } = require('../utils/stripeClient');
const { markPaymentPaid } = require('../services/paymentPostProcessService');
const { sendPaymentConfirmationEmail } = require('../services/paymentConfirmationEmail');
const DOCUMENTED_WEBHOOK_TYPES = require('../constants/stripeWebhookEventTypes');
const Provider = require('../models/Provider');

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

/**
 * Connect account status changed (onboarding progressed, requirements added,
 * Stripe restricted the account, ...). This is the ONLY place
 * stripe_connect_status / stripe_payouts_enabled are written after the
 * initial "pending" set by stripeConnectController — Stripe is the source of
 * truth for whether an account can actually receive payouts.
 */
async function handleAccountUpdated(account) {
  if (!account?.id) return;
  const rows = await Provider.findAll({ filters: { stripe_account_id: account.id }, limit: 1 });
  const provider = rows[0];
  if (!provider) {
    // Not one of our providers (or metadata/account id mismatch) — ignore.
    return;
  }

  let status = 'pending';
  if (account.payouts_enabled && account.charges_enabled) status = 'active';
  else if (account.requirements?.disabled_reason) status = 'restricted';

  await Provider.update(provider.id, {
    stripe_connect_status: status,
    stripe_payouts_enabled: account.payouts_enabled ? 1 : 0,
  });
}

// Exported for unit tests (bypasses the signature-verification HTTP layer).
exports.handleAccountUpdated = handleAccountUpdated;

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

/** POST /api/stripe/webhook — "Votre compte" event scope (checkout, payments, ...). */
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

/**
 * POST /api/stripe/webhook/connect — "Comptes connectés" event scope.
 * Separate destination in the Stripe Dashboard, separate signing secret
 * (STRIPE_CONNECT_WEBHOOK_SECRET) — Stripe does not let one destination
 * receive both "Votre compte" and "Comptes connectés" events, so this
 * cannot be merged into exports.handle above.
 */
exports.handleConnect = (req, res) =>
  verifyAndDispatch(req, res, {
    secret: STRIPE_CONNECT_WEBHOOK_SECRET,
    label: 'connect',
    dispatch: async (event) => {
      switch (event.type) {
        case 'account.updated':
          await handleAccountUpdated(event.data.object);
          break;

        default:
          logWebhookEvent(event);
      }
    },
  });
