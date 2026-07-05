const test = require('node:test');
const assert = require('node:assert/strict');

const { assessReviewEligibility, REVIEW_REJECTION } = require('../utils/reviewEligibility');
const { aggregateRating } = require('../utils/ratingAggregate');

const completedPaidRequest = { id: 1, client_id: 10, provider_id: 20, status: 'completed' };
const paidPayment = { request_id: 1, status: 'paid' };

test('eligibility: happy path returns provider from the booking', () => {
  const v = assessReviewEligibility({
    request: completedPaidRequest,
    payments: [paidPayment],
    existingReviews: [],
    clientId: 10,
    rating: 5,
  });
  assert.deepEqual(v, { ok: true, providerId: 20 });
});

test('eligibility: rating must be an integer 1-5', () => {
  for (const bad of [0, 6, 3.5, 'x', null, undefined]) {
    const v = assessReviewEligibility({ request: completedPaidRequest, payments: [paidPayment], clientId: 10, rating: bad });
    assert.equal(v.ok, false);
    assert.equal(v.reason, REVIEW_REJECTION.BAD_RATING);
  }
});

test('eligibility: missing booking rejected', () => {
  const v = assessReviewEligibility({ request: null, clientId: 10, rating: 5 });
  assert.equal(v.reason, REVIEW_REJECTION.NO_REQUEST);
});

test("eligibility: cannot review someone else's booking", () => {
  const v = assessReviewEligibility({ request: completedPaidRequest, payments: [paidPayment], clientId: 999, rating: 5 });
  assert.equal(v.reason, REVIEW_REJECTION.NOT_YOUR_REQUEST);
});

test('eligibility: asserted provider must match the booking', () => {
  const v = assessReviewEligibility({ request: completedPaidRequest, payments: [paidPayment], clientId: 10, providerId: 77, rating: 5 });
  assert.equal(v.reason, REVIEW_REJECTION.WRONG_PROVIDER);
});

test('eligibility: booking must be completed', () => {
  const v = assessReviewEligibility({ request: { ...completedPaidRequest, status: 'accepted' }, payments: [paidPayment], clientId: 10, rating: 5 });
  assert.equal(v.reason, REVIEW_REJECTION.NOT_COMPLETED);
});

test('eligibility: must have a paid payment (or released escrow)', () => {
  const unpaid = assessReviewEligibility({ request: completedPaidRequest, payments: [{ request_id: 1, status: 'pending' }], clientId: 10, rating: 5 });
  assert.equal(unpaid.reason, REVIEW_REJECTION.NOT_PAID);

  const released = assessReviewEligibility({ request: completedPaidRequest, payments: [{ request_id: 1, status: 'pending', escrow_status: 'released' }], clientId: 10, rating: 5 });
  assert.equal(released.ok, true);
});

test('eligibility: one review per booking', () => {
  const v = assessReviewEligibility({
    request: completedPaidRequest,
    payments: [paidPayment],
    existingReviews: [{ client_id: 10, request_id: 1 }],
    clientId: 10,
    rating: 5,
  });
  assert.equal(v.reason, REVIEW_REJECTION.ALREADY_REVIEWED);
});

test('aggregateRating: averages and counts, rounded to 1dp', () => {
  assert.deepEqual(aggregateRating([{ rating: 5 }, { rating: 4 }, { rating: 4 }]), { rating: 4.3, review_count: 3 });
  assert.deepEqual(aggregateRating([]), { rating: 0, review_count: 0 });
});

test('aggregateRating: ignores out-of-range / non-numeric ratings', () => {
  assert.deepEqual(aggregateRating([{ rating: 5 }, { rating: 9 }, { rating: 'x' }, { rating: 3 }]), { rating: 4, review_count: 2 });
});
