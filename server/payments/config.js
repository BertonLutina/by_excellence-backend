/**
 * Payment configuration, read from environment (same convention as
 * server/utils/commission.js). Kept inside the payments module so the layer is
 * fully self-contained and additive.
 *
 * Required to go live with mobile money (choose ONE provider):
 *   PAYMENT_MOBILE_PROVIDER = flutterwave | paystack
 *   FLUTTERWAVE_SECRET_KEY / FLUTTERWAVE_PUBLIC_KEY / FLUTTERWAVE_WEBHOOK_HASH
 *   PAYSTACK_SECRET_KEY / PAYSTACK_PUBLIC_KEY
 * Optional:
 *   PAYMENT_DEFAULT_CURRENCY (default: derived per-request; falls back to USD)
 */

function env(name, fallback = '') {
  const v = process.env[name];
  return v == null ? fallback : String(v).trim();
}

function paymentsConfig() {
  return {
    // 'flutterwave' | 'paystack' | '' (unset = mobile money not configured yet)
    mobileProvider: env('PAYMENT_MOBILE_PROVIDER').toLowerCase(),
    defaultCurrency: env('PAYMENT_DEFAULT_CURRENCY').toUpperCase(),

    flutterwave: {
      secretKey: env('FLUTTERWAVE_SECRET_KEY'),
      publicKey: env('FLUTTERWAVE_PUBLIC_KEY'),
      webhookHash: env('FLUTTERWAVE_WEBHOOK_HASH'),
    },
    paystack: {
      secretKey: env('PAYSTACK_SECRET_KEY'),
      publicKey: env('PAYSTACK_PUBLIC_KEY'),
    },
  };
}

/** Is the configured mobile-money provider ready (keys present)? */
function isMobileMoneyConfigured() {
  const c = paymentsConfig();
  if (c.mobileProvider === 'flutterwave') return Boolean(c.flutterwave.secretKey);
  if (c.mobileProvider === 'paystack') return Boolean(c.paystack.secretKey);
  return false;
}

module.exports = { paymentsConfig, isMobileMoneyConfigured };
