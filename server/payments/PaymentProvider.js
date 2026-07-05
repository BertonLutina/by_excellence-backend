/**
 * PaymentProvider — the common contract every payment gateway adapter implements.
 *
 * The rest of the app talks to *this* interface, never to Stripe / Flutterwave /
 * Paystack directly. That means adding a new gateway (or a new country's mobile
 * money) is a new adapter, not a change to the checkout/webhook/payout code.
 *
 * All monetary inputs are MAJOR units (e.g. 1500.50) plus an ISO currency code;
 * adapters convert to gateway minor units via ./money.js.
 */

/** Canonical payment states, normalized across every gateway. */
const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  CANCELED: 'canceled',
});

/** Capability flags an adapter advertises so the registry can route to it. */
/**
 * @typedef {Object} ProviderCapabilities
 * @property {string} id                 stable key, e.g. 'stripe' | 'flutterwave'
 * @property {string[]} methods          e.g. ['card'] | ['card','mobile_money','bank']
 * @property {string[]|'*'} currencies   supported ISO codes, or '*' for any
 * @property {string[]} [countries]      ISO-2 country hints (optional)
 * @property {boolean} payouts           can it pay providers out?
 * @property {boolean} configured        are credentials present?
 */

/**
 * @typedef {Object} CheckoutRequest
 * @property {number} amount             major units
 * @property {string} currency           ISO 4217 code
 * @property {string} reference          our idempotent order/payment reference
 * @property {string} [customerEmail]
 * @property {string} [method]           'card' | 'mobile_money' | 'bank'
 * @property {string} [returnUrl]
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} CheckoutResult
 * @property {string} providerRef        gateway session/transaction id
 * @property {string} status             one of PAYMENT_STATUS
 * @property {string} [redirectUrl]      where to send the client to pay
 * @property {Object} [raw]              raw gateway payload (for debugging)
 */

/**
 * @typedef {Object} WebhookResult
 * @property {string} reference          our reference this event concerns
 * @property {string} providerRef
 * @property {string} status             one of PAYMENT_STATUS
 * @property {number} [amount]           major units, if present
 * @property {string} [currency]
 * @property {string} eventType
 */

class NotConfiguredError extends Error {
  constructor(providerId) {
    super(`Payment provider "${providerId}" is not configured (missing API keys).`);
    this.name = 'NotConfiguredError';
    this.code = 'PROVIDER_NOT_CONFIGURED';
    this.providerId = providerId;
    this.statusCode = 503;
  }
}

/**
 * Base class. Adapters extend this and override the methods they support.
 * Unimplemented methods fail loudly rather than silently doing nothing.
 */
class PaymentProvider {
  /** @returns {ProviderCapabilities} */
  capabilities() {
    throw new Error('capabilities() not implemented');
  }

  /** @param {CheckoutRequest} _req @returns {Promise<CheckoutResult>} */
  async createCheckout(_req) {
    throw new Error(`${this.capabilities().id}: createCheckout() not implemented`);
  }

  /** @param {string} _providerRef @returns {Promise<{status:string, raw?:object}>} */
  async verifyPayment(_providerRef) {
    throw new Error(`${this.capabilities().id}: verifyPayment() not implemented`);
  }

  /**
   * Validate signature + normalize a webhook into a WebhookResult.
   * @param {{ headers?: object, rawBody?: Buffer|string, body?: object }} _payload
   * @returns {Promise<WebhookResult>}
   */
  async parseWebhook(_payload) {
    throw new Error(`${this.capabilities().id}: parseWebhook() not implemented`);
  }

  /**
   * Pay a provider out (escrow release / settlement).
   * @param {{ amount:number, currency:string, destination:object, reference:string }} _req
   */
  async createPayout(_req) {
    throw new Error(`${this.capabilities().id}: createPayout() not implemented`);
  }
}

module.exports = { PaymentProvider, PAYMENT_STATUS, NotConfiguredError };
