/**
 * Checkout / PaymentIntent params for money that stays on the By Excellence
 * Stripe account. Connect fields are rejected so a charge can never be split
 * or sent to a connected account at payment time.
 */
const FORBIDDEN_KEYS = [
  'transfer_data',
  'application_fee_amount',
  'application_fee',
  'on_behalf_of',
  'stripeAccount',
];

function assertPlatformCharge(payload) {
  const walk = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.includes(key)) {
        throw new Error(`Platform charges must not include ${key}`);
      }
      walk(child);
    }
  };
  walk(payload);
  return payload;
}

/**
 * Hosted Checkout session charged entirely on the platform account.
 * `unitAmount` is the full amount the client owes, in minor units.
 */
function buildCheckoutPaymentSession({
  currency,
  productName,
  productDescription,
  unitAmount,
  successUrl,
  cancelUrl,
  metadata,
}) {
  const productData = { name: productName };
  if (productDescription) productData.description = productDescription;
  return assertPlatformCharge({
    line_items: [
      {
        price_data: {
          currency,
          product_data: productData,
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  });
}

module.exports = {
  FORBIDDEN_KEYS,
  assertPlatformCharge,
  buildCheckoutPaymentSession,
};
