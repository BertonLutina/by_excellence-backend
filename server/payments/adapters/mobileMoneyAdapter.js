/**
 * MobileMoneyAdapter — provider-agnostic adapter for African mobile money.
 *
 * It targets ONE aggregator chosen via PAYMENT_MOBILE_PROVIDER (flutterwave |
 * paystack). Both expose the same primitives (create a charge/checkout, verify a
 * transaction, receive a webhook, transfer to a recipient), so a single adapter
 * with a small per-provider branch keeps things simple.
 *
 * STATUS: scaffold. The HTTP calls to the aggregator are marked with TODO(wire).
 * Until keys are set (see ./config.js) every method throws NotConfiguredError,
 * so nothing silently half-works. Wiring one provider = filling the 4 TODOs.
 */
const { PaymentProvider, PAYMENT_STATUS, NotConfiguredError } = require('../PaymentProvider');
const { paymentsConfig, isMobileMoneyConfigured } = require('../config');
const { toMinorUnits, fromMinorUnits } = require('../money');

// African currencies these aggregators commonly settle. '*' would over-promise,
// so we advertise a concrete (extensible) list used for routing.
const MOBILE_MONEY_CURRENCIES = [
  'NGN', 'GHS', 'KES', 'UGX', 'TZS', 'RWF', 'ZAR', 'XOF', 'XAF', 'ZMW', 'MWK', 'USD',
];

class MobileMoneyAdapter extends PaymentProvider {
  capabilities() {
    const cfg = paymentsConfig();
    return {
      id: cfg.mobileProvider || 'mobile_money',
      methods: ['mobile_money', 'card', 'bank'],
      currencies: MOBILE_MONEY_CURRENCIES,
      configured: isMobileMoneyConfigured(),
      payouts: true,
    };
  }

  #assertReady() {
    if (!isMobileMoneyConfigured()) {
      throw new NotConfiguredError(paymentsConfig().mobileProvider || 'mobile_money');
    }
  }

  async createCheckout(req) {
    this.#assertReady();
    const cfg = paymentsConfig();
    const { amount, currency } = req;
    const minor = toMinorUnits(amount, currency);

    if (cfg.mobileProvider === 'flutterwave') {
      // TODO(wire): POST https://api.flutterwave.com/v3/payments
      //   headers: { Authorization: `Bearer ${cfg.flutterwave.secretKey}` }
      //   body: { tx_ref: req.reference, amount, currency, redirect_url: req.returnUrl,
      //           customer: { email: req.customerEmail },
      //           payment_options: 'mobilemoneyghana,mpesa,card' }
      //   -> return { providerRef: data.id, status: PENDING, redirectUrl: data.link, raw }
      throw new Error('flutterwave.createCheckout: TODO(wire) — see PAYMENTS_INTEGRATION.md');
    }
    if (cfg.mobileProvider === 'paystack') {
      // TODO(wire): POST https://api.paystack.co/transaction/initialize
      //   headers: { Authorization: `Bearer ${cfg.paystack.secretKey}` }
      //   body: { reference: req.reference, amount: minor, currency,
      //           email: req.customerEmail, callback_url: req.returnUrl,
      //           channels: ['mobile_money','card','bank'] }
      //   -> return { providerRef: data.reference, status: PENDING,
      //               redirectUrl: data.authorization_url, raw }
      throw new Error('paystack.createCheckout: TODO(wire) — see PAYMENTS_INTEGRATION.md');
    }
    void minor;
    throw new NotConfiguredError('mobile_money');
  }

  async verifyPayment(providerRef) {
    this.#assertReady();
    const cfg = paymentsConfig();
    // TODO(wire):
    //   flutterwave: GET /v3/transactions/{id}/verify  -> data.status === 'successful'
    //   paystack:    GET /transaction/verify/{reference} -> data.status === 'success'
    // Map to PAYMENT_STATUS.PAID / PENDING / FAILED.
    throw new Error(`${cfg.mobileProvider}.verifyPayment(${providerRef}): TODO(wire)`);
  }

  async parseWebhook(payload) {
    this.#assertReady();
    const cfg = paymentsConfig();
    // TODO(wire) — verify signature FIRST, then normalize:
    //   flutterwave: header 'verif-hash' must equal cfg.flutterwave.webhookHash;
    //                event 'charge.completed' & data.status 'successful' -> PAID
    //   paystack:    HMAC-SHA512(rawBody, secretKey) must equal header
    //                'x-paystack-signature'; event 'charge.success' -> PAID
    // Return { reference, providerRef, status, amount, currency, eventType }.
    void payload; void fromMinorUnits;
    throw new Error(`${cfg.mobileProvider}.parseWebhook: TODO(wire) — signature check required`);
  }

  async createPayout(req) {
    this.#assertReady();
    const cfg = paymentsConfig();
    // TODO(wire) — provider settlement / transfer to the provider's payout account:
    //   flutterwave: POST /v3/transfers (bank) or /v3/transfers mobile money beneficiary
    //   paystack:    POST /transferrecipient then POST /transfer
    throw new Error(`${cfg.mobileProvider}.createPayout(${req.reference}): TODO(wire)`);
  }
}

module.exports = MobileMoneyAdapter;
module.exports.MOBILE_MONEY_CURRENCIES = MOBILE_MONEY_CURRENCIES;
