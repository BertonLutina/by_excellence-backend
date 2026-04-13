const { getStripe } = require('../utils/stripeClient');

/** Attaches `req.stripe` or responds 503 if STRIPE_SECRET_KEY is unset. */
function requireStripeConfigured(req, res, next) {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured (STRIPE_SECRET_KEY)' });
  }
  req.stripe = stripe;
  next();
}

module.exports = requireStripeConfigured;
