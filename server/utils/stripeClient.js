const Stripe = require('stripe');
const { STRIPE_SECRET_KEY } = require('../../constants/constant');

function getStripe() {
  if (!STRIPE_SECRET_KEY) return null;
  return new Stripe(STRIPE_SECRET_KEY);
}

function isTestStripeKey() {
  return String(STRIPE_SECRET_KEY || '').startsWith('sk_test_');
}

module.exports = { getStripe, isTestStripeKey };
