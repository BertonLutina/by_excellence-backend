const createEntityController = require('./createEntityController');
const Offer = require('../models/Offer');
const { executeSQL } = require('../db/db');
const { notifyOfferStatusChange } = require('../services/notificationService');
const { applyOfferFinancials } = require('../utils/offerFinancials');
const { providerCanCreateOffer } = require('../services/serviceRequestCollaborationService');
const { isAdmin, providerIdForUser, isOfferProvider, isOfferClient, pickFields } = require('../utils/entityAccess');

const base = createEntityController(Offer, 'Offer');

/** Fields a client may touch on an offer of their own request (accept/reject + installments). */
const CLIENT_OFFER_FIELDS = ['status', 'installment_requested', 'installment_count', 'installment_status'];
const CLIENT_OFFER_STATUSES = new Set(['accepted', 'rejected']);

async function loadProvider(providerId) {
  const rows = await executeSQL(
    'SELECT id, provider_tier, premium_commission_percent FROM providers WHERE id = ? LIMIT 1',
    [providerId]
  );
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  return list[0] || null;
}

async function prepareOfferBody(body) {
  const providerId = body?.provider_id;
  if (!providerId) return body;
  const provider = await loadProvider(providerId);
  if (!provider) throw new Error('Invalid provider_id');
  return applyOfferFinancials(body, provider);
}

module.exports = {
  ...base,

  create: async (req, res) => {
    try {
      const raw = req.body && typeof req.body === 'object' ? req.body : {};
      const requestId = raw.request_id;
      const providerId = raw.provider_id;
      // Object-level authorization: a non-admin may only create offers for their own provider profile.
      if (!isAdmin(req.user)) {
        const ownPid = await providerIdForUser(req.user?.id);
        if (ownPid == null || Number(providerId) !== ownPid) {
          return res.status(403).json({ error: 'You can only create offers for your own provider profile' });
        }
      }
      if (requestId && providerId) {
        const allowed = await providerCanCreateOffer(requestId, providerId);
        if (!allowed) {
          return res.status(403).json({ error: 'Provider is not allowed to create an offer on this request' });
        }
      }
      const body = await prepareOfferBody(raw);
      const row = await Offer.create(body);
      res.status(201).json(row);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const before = await Offer.findById(req.params.id);
      if (!before) return res.status(404).json({ error: 'Not found' });

      let body = req.body && typeof req.body === 'object' ? { ...req.body } : {};

      // Object-level authorization (anti-IDOR).
      if (!isAdmin(req.user)) {
        if (await isOfferProvider(before, req.user?.id)) {
          // Owning provider: full edit, but cannot reassign the offer.
          delete body.provider_id;
          delete body.request_id;
        } else if (await isOfferClient(before, req.user?.id)) {
          // Client of the request: accept/reject + installment request only.
          const [filtered, rejected] = pickFields(body, CLIENT_OFFER_FIELDS);
          if (rejected.length) {
            return res.status(403).json({ error: `Clients cannot modify: ${rejected.join(', ')}` });
          }
          if (filtered.status != null && !CLIENT_OFFER_STATUSES.has(filtered.status)) {
            return res.status(403).json({ error: 'Clients can only accept or reject an offer' });
          }
          body = filtered;
        } else {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
      const providerId = body.provider_id ?? before.provider_id;
      if (body.items != null || body.commission_mode != null || body.deposit_percentage != null || body.payment_flow != null) {
        body = await prepareOfferBody({
          ...before,
          ...body,
          provider_id: providerId,
        });
      }

      const row = await Offer.update(req.params.id, body);
      if (!row) return res.status(404).json({ error: 'Not found' });

      if (req.body?.status && before?.status && before.status !== row.status) {
        notifyOfferStatusChange(row.id, row.status).catch((e) => {
          console.warn('[Offer update] notify failed:', e.message);
        });
      }

      res.json(row);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const before = await Offer.findById(req.params.id);
      if (!before) return res.status(404).json({ error: 'Not found' });
      if (!isAdmin(req.user) && !(await isOfferProvider(before, req.user?.id))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      await Offer.delete(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
