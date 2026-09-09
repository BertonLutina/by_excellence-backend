/**
 * Stripe Connect onboarding for providers ("recevoir mes paiements via Stripe").
 *
 * Flow:
 *   1. Provider checks the "Connect with Stripe" box (signup, profile settings,
 *      or an admin doing it on their behalf) -> POST /:id/stripe-connect.
 *   2. We create a Stripe Express account once (idempotent — reuses
 *      stripe_account_id if one already exists) and return a fresh, single-use
 *      Account Link the client redirects the browser to.
 *   3. Provider completes Stripe's hosted KYC form; Stripe redirects back to
 *      STRIPE_CONNECT_RETURN_PATH.
 *   4. The account.updated webhook (stripeWebhookController) is the ONLY thing
 *      that flips stripe_connect_status/stripe_payouts_enabled — never this
 *      controller — because charges_enabled/payouts_enabled can change later
 *      (e.g. Stripe restricts an account after the fact).
 *
 * Ownership: only the provider's own owner (providers.user_id === req.user.id)
 * or an admin may call these routes. Same rule as providerController.update's
 * IDOR fix — this is the same trust boundary, just for a more sensitive field.
 */
const Provider = require('../models/Provider');
const User = require('../models/User');
const { serializeProviderRow } = require('../utils/serializeProvider');
const {
  FRONTEND_ORIGIN,
  STRIPE_CONNECT_COUNTRY,
  STRIPE_CONNECT_REFRESH_PATH,
  STRIPE_CONNECT_RETURN_PATH,
} = require('../../constants/constant');

function canManage(req, providerRow) {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  return providerRow.user_id != null && String(providerRow.user_id) === String(req.user.id);
}

function absoluteUrl(path) {
  const base = String(FRONTEND_ORIGIN || '').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** POST /api/providers/:id/stripe-connect — create (if needed) + return onboarding link. */
exports.startOnboarding = async (req, res) => {
  try {
    const existing = await Provider.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!canManage(req, existing)) return res.status(403).json({ error: 'Forbidden' });

    const stripe = req.stripe;
    let accountId = existing.stripe_account_id;

    if (!accountId) {
      const owner = await User.findById(existing.user_id);
      const account = await stripe.accounts.create({
        type: 'express',
        country: STRIPE_CONNECT_COUNTRY,
        email: owner?.email || undefined,
        business_type: existing.structure_type === 'team' ? 'company' : 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          provider_id: String(existing.id),
          user_id: String(existing.user_id || ''),
        },
      });
      accountId = account.id;
      await Provider.update(existing.id, {
        stripe_account_id: accountId,
        stripe_connect_status: 'pending',
        stripe_connect_requested_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
    } else if (!existing.stripe_connect_status || existing.stripe_connect_status === 'none') {
      await Provider.update(existing.id, {
        stripe_connect_status: 'pending',
        stripe_connect_requested_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: absoluteUrl(STRIPE_CONNECT_REFRESH_PATH),
      return_url: absoluteUrl(STRIPE_CONNECT_RETURN_PATH),
    });

    return res.json({ url: accountLink.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** GET /api/providers/:id/stripe-connect — cached connection status (no live Stripe call). */
exports.getStatus = async (req, res) => {
  try {
    const existing = await Provider.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!canManage(req, existing)) return res.status(403).json({ error: 'Forbidden' });

    const row = serializeProviderRow(existing);
    return res.json({
      connected: Boolean(existing.stripe_account_id),
      status: row.stripe_connect_status,
      payouts_enabled: row.stripe_payouts_enabled,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
