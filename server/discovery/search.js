/**
 * Provider search + relevance ranking (Roadmap Phase 7).
 *
 * A pure function that filters a set of providers by the usual marketplace
 * criteria and ranks the survivors by relevance. Ranking rewards the signals that
 * make a marketplace feel trustworthy and useful: rating, review volume,
 * verification, tier, a text match, and (when searching "near me") proximity.
 *
 * At small scale run this in-memory over Provider.findAll(); at larger scale push
 * the cheap filters into SQL and use this to score the shortlist. The scoring
 * weights live in one place (SCORE_WEIGHTS) so they're easy to tune.
 */
const { haversineKm } = require('./geo');

const SCORE_WEIGHTS = Object.freeze({
  ratingPerStar: 10,     // rating 0–5 -> 0–50
  reviewCap: 100,        // reviews counted up to this
  reviewPerUnit: 0.2,    // -> up to +20
  verified: 15,
  premiumTier: 5,
  textMatch: 8,
  proximityMax: 20,      // full points when distance ~0, 0 at the radius edge
});

function truthy(v) {
  return v === true || v === 1 || v === '1' || v === 'true';
}

function textOf(p) {
  return `${p.display_name || ''} ${p.profession || ''} ${p.bio || ''} ${p.city || ''}`.toLowerCase();
}

function passesFilters(p, c, distanceKm) {
  if (c.activeOnly !== false && p.status && p.status !== 'active') return false;
  if (c.verifiedOnly && !truthy(p.is_verified)) return false;
  if (c.categoryId != null && Number(p.category_id) !== Number(c.categoryId)) return false;
  if (c.tier && p.provider_tier !== c.tier) return false;
  if (c.minRating != null && (Number(p.rating) || 0) < Number(c.minRating)) return false;
  if (c.priceMin != null && (Number(p.price_from) || 0) < Number(c.priceMin)) return false;
  if (c.priceMax != null && (Number(p.price_from) || 0) > Number(c.priceMax)) return false;
  if (c.city && !c.near) {
    if (String(p.city || '').toLowerCase() !== String(c.city).toLowerCase()) return false;
  }
  if (c.near) {
    if (distanceKm == null) return false;                 // no coords -> excluded from geo search
    if (distanceKm > Number(c.near.radiusKm)) return false;
  }
  if (c.query) {
    if (!textOf(p).includes(String(c.query).toLowerCase())) return false;
  }
  return true;
}

function scoreProvider(p, c, distanceKm) {
  const w = SCORE_WEIGHTS;
  let score = 0;
  score += (Number(p.rating) || 0) * w.ratingPerStar;
  score += Math.min(Number(p.review_count) || 0, w.reviewCap) * w.reviewPerUnit;
  if (truthy(p.is_verified)) score += w.verified;
  if (p.provider_tier === 'premium') score += w.premiumTier;
  if (c.query && textOf(p).includes(String(c.query).toLowerCase())) score += w.textMatch;
  if (c.near && distanceKm != null) {
    const r = Number(c.near.radiusKm) || 1;
    score += Math.max(0, (r - distanceKm) / r) * w.proximityMax;
  }
  return Math.round(score * 100) / 100;
}

/**
 * @param {Array} providers
 * @param {Object} criteria { query, categoryId, city, tier, verifiedOnly, minRating,
 *                            priceMin, priceMax, near:{lat,lng,radiusKm}, activeOnly, limit }
 * @returns {Array} ranked providers, each with _score and (if near) _distanceKm
 */
function searchProviders(providers = [], criteria = {}) {
  const c = criteria || {};
  const out = [];
  for (const p of providers || []) {
    const distanceKm = c.near ? haversineKm(c.near, { lat: p.lat, lng: p.lng }) : null;
    if (!passesFilters(p, c, distanceKm)) continue;
    out.push({
      ...p,
      _score: scoreProvider(p, c, distanceKm),
      ...(distanceKm != null ? { _distanceKm: Math.round(distanceKm * 10) / 10 } : {}),
    });
  }
  out.sort((a, b) =>
    b._score - a._score ||
    (Number(b.rating) || 0) - (Number(a.rating) || 0) ||
    (Number(b.review_count) || 0) - (Number(a.review_count) || 0)
  );
  return c.limit ? out.slice(0, Number(c.limit)) : out;
}

module.exports = { searchProviders, scoreProvider, SCORE_WEIGHTS };
