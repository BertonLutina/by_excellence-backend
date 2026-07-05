/**
 * Review eligibility (Roadmap Phase 3 — trust).
 *
 * A review is only credible if it comes from a real, paid, completed booking.
 * This pure function decides whether a client may review a provider, given the
 * booking + its payments + any existing review. Keeping it pure makes the trust
 * rules easy to test and reuse.
 *
 * Rules (all must hold):
 *   1. rating is an integer 1–5
 *   2. the service request exists and belongs to this client
 *   3. (if a provider is asserted) it matches the request's provider
 *   4. the request is completed
 *   5. at least one payment for it is paid (or its escrow was released)
 *   6. the client hasn't already reviewed this request
 */

const REVIEW_REJECTION = Object.freeze({
  BAD_RATING: 'bad_rating',
  NO_REQUEST: 'no_request',
  NOT_YOUR_REQUEST: 'not_your_request',
  WRONG_PROVIDER: 'wrong_provider',
  NOT_COMPLETED: 'not_completed',
  NOT_PAID: 'not_paid',
  ALREADY_REVIEWED: 'already_reviewed',
});

function isValidRating(rating) {
  const n = Number(rating);
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

function isPaid(payment) {
  return payment?.status === 'paid' || payment?.escrow_status === 'released';
}

/**
 * @param {Object} ctx
 * @param {Object|null} ctx.request        the service_request row
 * @param {Array}  [ctx.payments]          payments for that request
 * @param {Array}  [ctx.existingReviews]   reviews already filed for that request
 * @param {number|string} ctx.clientId     the caller
 * @param {number|string} [ctx.providerId] provider asserted by the client (optional)
 * @param {number|string} ctx.rating
 * @returns {{ ok: true, providerId: any } | { ok: false, reason: string }}
 */
function assessReviewEligibility(ctx = {}) {
  const { request, payments = [], existingReviews = [], clientId, providerId, rating } = ctx;

  if (!isValidRating(rating)) return { ok: false, reason: REVIEW_REJECTION.BAD_RATING };
  if (!request) return { ok: false, reason: REVIEW_REJECTION.NO_REQUEST };

  if (Number(request.client_id) !== Number(clientId)) {
    return { ok: false, reason: REVIEW_REJECTION.NOT_YOUR_REQUEST };
  }
  if (providerId != null && Number(request.provider_id) !== Number(providerId)) {
    return { ok: false, reason: REVIEW_REJECTION.WRONG_PROVIDER };
  }
  if (request.status !== 'completed') {
    return { ok: false, reason: REVIEW_REJECTION.NOT_COMPLETED };
  }
  if (!Array.isArray(payments) || !payments.some(isPaid)) {
    return { ok: false, reason: REVIEW_REJECTION.NOT_PAID };
  }
  const alreadyReviewed = existingReviews.some(
    (r) => Number(r.client_id) === Number(clientId)
  );
  if (alreadyReviewed) return { ok: false, reason: REVIEW_REJECTION.ALREADY_REVIEWED };

  return { ok: true, providerId: request.provider_id };
}

module.exports = { assessReviewEligibility, isValidRating, isPaid, REVIEW_REJECTION };
