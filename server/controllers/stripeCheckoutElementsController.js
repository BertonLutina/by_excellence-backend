const {
  FRONTEND_ORIGIN,
  IS_DEV,
  STRIPE_ELEMENTS_PRICE_ID,
  STRIPE_ELEMENTS_RETURN_PATH,
  STRIPE_CHECKOUT_ELEMENTS_AUTOMATIC_TAX,
} = require('../../constants/constant');
const { getStripe } = require('../utils/stripeClient');

function returnBaseUrl() {
  const base = (FRONTEND_ORIGIN || (IS_DEV ? 'http://localhost:5173' : '')).trim().replace(/\/$/, '');
  return base;
}

/**
 * Stripe sample: Checkout with ui_mode "elements" — returns clientSecret for Payment Element / Embedded Checkout.
 * POST /api/stripe/create-checkout-session
 * Body (optional): { quantity?: number } — price id comes from env STRIPE_ELEMENTS_PRICE_ID.
 */
exports.createCheckoutSession = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured (STRIPE_SECRET_KEY)' });
  }
  const priceId = (STRIPE_ELEMENTS_PRICE_ID || '').trim();
  if (!priceId) {
    return res.status(503).json({
      error: 'Set STRIPE_ELEMENTS_PRICE_ID in env (Dashboard → Products → Price ID, e.g. price_...)',
    });
  }

  const base = returnBaseUrl();
  if (!base) {
    return res.status(500).json({ error: 'FRONTEND_ORIGIN is required for return_url' });
  }

  const pathPart = (STRIPE_ELEMENTS_RETURN_PATH || '/#/stripecheckoutcomplete').trim();
  const returnPath = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const return_url = `${base}${returnPath}?session_id={CHECKOUT_SESSION_ID}`;

  let quantity = Number(req.body?.quantity);
  if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
  if (quantity > 99) quantity = 99;

  const payload = {
    ui_mode: 'elements',
    line_items: [{ price: priceId, quantity }],
    mode: 'payment',
    return_url,
  };

  if (STRIPE_CHECKOUT_ELEMENTS_AUTOMATIC_TAX) {
    payload.automatic_tax = { enabled: true };
  }

  try {
    const session = await stripe.checkout.sessions.create(payload);
    return res.json({ clientSecret: session.client_secret });
  } catch (err) {
    const msg = err?.message || 'Stripe checkout session failed';
    console.error('[createCheckoutSession]', msg);
    return res.status(400).json({ error: msg });
  }
};

/**
 * GET /api/stripe/session-status?session_id=cs_...
 */
exports.sessionStatus = async (req, res) => {
  const sessionId = (req.query.session_id || '').trim();
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id query parameter required' });
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    const pi = session.payment_intent;
    const payment_intent_id = typeof pi === 'string' ? pi : pi?.id ?? null;
    const payment_intent_status =
      typeof pi === 'object' && pi && pi.status ? pi.status : null;

    return res.json({
      status: session.status,
      payment_status: session.payment_status,
      payment_intent_id,
      payment_intent_status,
    });
  } catch (err) {
    const msg = err?.message || 'Failed to retrieve session';
    console.error('[sessionStatus]', msg);
    return res.status(400).json({ error: msg });
  }
};
