const createEntityController = require('./createEntityController');
const Review = require('../models/Review');
const Payment = require('../models/Payment');
const ServiceRequest = require('../models/ServiceRequest');
const Provider = require('../models/Provider');
const { isAdmin, providerIdForUser, pickFields } = require('../utils/entityAccess');
const { assessReviewEligibility } = require('../utils/reviewEligibility');
const { aggregateRating } = require('../utils/ratingAggregate');

const base = createEntityController(Review, 'Review');

/**
 * Recompute a provider's public rating + review_count from their reviews.
 * Best-effort and non-blocking: the caller fires this after the response is sent,
 * so a stats update never delays or fails the review write.
 */
async function recomputeProviderRating(providerId) {
  const pid = Number(providerId);
  if (!pid) return;
  try {
    const reviews = await Review.findAll({ filters: { provider_id: pid }, limit: 1000 });
    const { rating, review_count } = aggregateRating(reviews);
    await Provider.update(pid, { rating, review_count });
  } catch (err) {
    console.warn('[recomputeProviderRating] failed:', err.message);
  }
}

/** Fields the review author may edit. */
const AUTHOR_FIELDS = ['rating', 'comment'];
/** Fields the reviewed provider may edit (public response). */
const PROVIDER_FIELDS = ['provider_response', 'provider_response_date'];

module.exports = {
  ...base,

  create: async (req, res) => {
    try {
      const body = { ...(req.body || {}) };
      // Author is always the caller (spoof-proof), except for admins.
      if (!isAdmin(req.user)) body.client_id = req.user?.id;

      // Trust gate: non-admins may only review a real, completed, paid booking,
      // and only once. Admins (e.g. backfills / moderation) bypass this.
      if (!isAdmin(req.user)) {
        const requestId = body.request_id;
        if (requestId == null) {
          return res.status(400).json({ error: 'request_id is required' });
        }
        const request = await ServiceRequest.findById(requestId);
        const [payments, existingReviews] = await Promise.all([
          Payment.findAll({ filters: { request_id: requestId }, limit: 200 }),
          Review.findAll({ filters: { request_id: requestId }, limit: 200 }),
        ]);

        const verdict = assessReviewEligibility({
          request,
          payments,
          existingReviews,
          clientId: req.user?.id,
          providerId: body.provider_id,
          rating: body.rating,
        });
        if (!verdict.ok) {
          const code = verdict.reason === 'already_reviewed' ? 409 : 403;
          return res.status(code).json({ error: 'Review not allowed', reason: verdict.reason });
        }
        // Trust the booking, not the client, for who is being reviewed.
        body.provider_id = verdict.providerId;
      }

      req.body = body;
      const out = await base.create(req, res);
      recomputeProviderRating(body.provider_id); // fire-and-forget after response
      return out;
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const before = await Review.findById(req.params.id);
      if (!before) return res.status(404).json({ error: 'Not found' });

      if (!isAdmin(req.user)) {
        const userId = req.user?.id != null ? Number(req.user.id) : null;
        const isAuthor = userId != null && Number(before.client_id) === userId;
        const pid = await providerIdForUser(userId);
        const isReviewedProvider = pid != null && Number(before.provider_id) === pid;

        const allowed = isAuthor ? AUTHOR_FIELDS : isReviewedProvider ? PROVIDER_FIELDS : null;
        if (!allowed) return res.status(403).json({ error: 'Forbidden' });

        const [filtered, rejected] = pickFields(req.body, allowed);
        if (rejected.length) {
          return res.status(403).json({ error: `Cannot modify: ${rejected.join(', ')}` });
        }
        req.body = filtered;
      }
      const out = await base.update(req, res);
      recomputeProviderRating(before.provider_id); // rating may have changed
      return out;
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const before = await Review.findById(req.params.id);
      if (!before) return res.status(404).json({ error: 'Not found' });
      const userId = req.user?.id != null ? Number(req.user.id) : null;
      const isAuthor = userId != null && Number(before.client_id) === userId;
      if (!isAdmin(req.user) && !isAuthor) return res.status(403).json({ error: 'Forbidden' });
      const out = await base.remove(req, res);
      recomputeProviderRating(before.provider_id); // recompute after deletion
      return out;
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
