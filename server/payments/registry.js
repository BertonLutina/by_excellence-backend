/**
 * Provider registry + selection.
 *
 * Selection order for a given request:
 *   1. Explicit provider id (e.g. payment.payment_provider === 'flutterwave').
 *   2. By method: 'mobile_money' -> the configured mobile-money provider.
 *   3. By currency: an African currency the mobile provider covers and Stripe
 *      typically doesn't settle -> mobile provider; otherwise Stripe.
 *   4. Default -> Stripe (preserves today's behavior).
 */
const StripeAdapter = require('./adapters/stripeAdapter');
const MobileMoneyAdapter = require('./adapters/mobileMoneyAdapter');
const { paymentsConfig } = require('./config');

const stripe = new StripeAdapter();
const mobile = new MobileMoneyAdapter();

function allAdapters() {
  return [stripe, mobile];
}

function byId(id) {
  return allAdapters().find((a) => a.capabilities().id === String(id).toLowerCase()) || null;
}

/** List capabilities of every registered adapter (for a /public/config surface). */
function listProviders() {
  return allAdapters().map((a) => a.capabilities());
}

/**
 * @param {{ provider?: string, method?: string, currency?: string }} req
 * @returns {import('./PaymentProvider').PaymentProvider}
 */
function getPaymentProvider(req = {}) {
  const { provider, method, currency } = req;

  // 1. Explicit
  if (provider) {
    const hit = byId(provider);
    if (hit) return hit;
  }

  const mobileCaps = mobile.capabilities();
  const mobileCurrencies = Array.isArray(mobileCaps.currencies) ? mobileCaps.currencies : [];
  const cfg = paymentsConfig();
  const mobileAvailable = Boolean(cfg.mobileProvider);

  // 2. By method
  if (method === 'mobile_money' && mobileAvailable) return mobile;

  // 3. By currency (African rails Stripe won't settle)
  if (currency && mobileAvailable) {
    const code = String(currency).toUpperCase();
    const stripeSettles = ['USD', 'EUR', 'GBP', 'ZAR'];
    if (mobileCurrencies.includes(code) && !stripeSettles.includes(code)) {
      return mobile;
    }
  }

  // 4. Default
  return stripe;
}

module.exports = { getPaymentProvider, listProviders, byId, allAdapters };
