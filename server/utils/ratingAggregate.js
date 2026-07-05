/**
 * Rating aggregation (Roadmap Phase 3 — trust).
 *
 * Recomputes a provider's public rating + review_count from their reviews.
 * Pure and deterministic so it can run after any review create/update/delete and
 * be unit-tested without a DB. Ratings round to 1 decimal (e.g. 4.3).
 */

function aggregateRating(reviews = []) {
  const valid = (Array.isArray(reviews) ? reviews : [])
    .map((r) => Number(r?.rating))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);

  const review_count = valid.length;
  if (review_count === 0) return { rating: 0, review_count: 0 };

  const sum = valid.reduce((s, n) => s + n, 0);
  const rating = Math.round((sum / review_count) * 10) / 10;
  return { rating, review_count };
}

module.exports = { aggregateRating };
