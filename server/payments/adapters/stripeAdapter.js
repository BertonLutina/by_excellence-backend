/**
 * Stripe adapter — wraps the EXISTING Stripe integration behind the common
 * PaymentProvider interface. It intentionally reuses server/utils/stripeClient
 * rather than reimplementing anything, so the current live card flow is unchanged;
 * this simply lets the registry treat Stripe as "one provider among several".
 */
const { PaymentProvider, PAYMENT_STATUS, NotConfiguredError } = require('../PaymentProvider');
const { toMinorUnits } = require('../money');
const { getStripe } = require('../../utils/stripeClient');
const { assertPlatformCharge } = require('../../utils/platformCharge');

// Stripe supports many currencies; we advertise '*' and let Stripe reject any it
// doesn't actually support at charge time.
class StripeAdapter extends PaymentProvider {
  capabilities() {
    return {
      id: 'stripe',
      methods: ['card'],
      currencies: '*',
      payouts: false,
      configured: Boolean(getStripe()),
    };
  }

  #client() {
    const stripe = getStripe();
    if (!stripe) throw new NotConfiguredError('stripe');
    return stripe;
  }

  async createCheckout(req) {
    const stripe = this.#client();
    const { amount, currency, reference, customerEmail, returnUrl, metadata } = req;
    // NOTE: the current app uses a fixed Stripe Price via
    // stripeCheckoutElementsController. This dynamic-amount path is the
    // forward-looking shape; wire whichever the controller needs.
    const session = await stripe.checkout.sessions.create(assertPlatformCharge({
      mode: 'payment',
      client_reference_id: reference,
      customer_email: customerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: String(currency).toLowerCase(),
            product_data: { name: metadata?.description || `Order ${reference}` },
            unit_amount: toMinorUnits(amount, currency),
          },
          quantity: 1,
        },
      ],
      success_url: returnUrl,
      metadata: { reference, ...(metadata || {}) },
    }));
    return {
      providerRef: session.id,
      status: PAYMENT_STATUS.PENDING,
      redirectUrl: session.url,
      raw: session,
    };
  }

  async verifyPayment(providerRef) {
    const stripe = this.#client();
    const session = await stripe.checkout.sessions.retrieve(providerRef);
    const status = session.payment_status === 'paid' ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING;
    return { status, raw: session };
  }

  async createPayout() {
    throw new Error('stripe: provider settlement is an in-app bank transfer, not a Stripe payout');
  }
}

module.exports = StripeAdapter;
