/**
 * Map Stripe SDK errors to HTTP responses (admin platform + checkout elements).
 */

function stripeErrorStatus(err) {
  const n = err && typeof err.statusCode === 'number' ? err.statusCode : NaN;
  return Number.isFinite(n) && n >= 400 ? n : 400;
}

function stripeErrorPayload(err) {
  return {
    error: err?.message || 'Stripe error',
    code: err.code,
    type: err.type,
    decline_code: err.decline_code,
    requestId: err.requestId,
  };
}

async function sendStripe(res, work) {
  try {
    const out = await work();
    res.json(out);
  } catch (err) {
    res.status(stripeErrorStatus(err)).json(stripeErrorPayload(err));
  }
}

function respondStripeError(res, err, logPrefix) {
  if (logPrefix) console.error(`[${logPrefix}]`, err?.message || err);
  res.status(stripeErrorStatus(err)).json(stripeErrorPayload(err));
}

module.exports = {
  sendStripe,
  respondStripeError,
  stripeErrorStatus,
  stripeErrorPayload,
};
