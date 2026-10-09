const createEntityController = require('./createEntityController');
const Offer = require('../models/Offer');
const { executeSQL } = require('../db/db');
const { notifyOfferStatusChange } = require('../services/notificationService');
const { applyOfferFinancials } = require('../utils/offerFinancials');
const { providerCanCreateOffer } = require('../services/serviceRequestCollaborationService');
const { attachSplitToOfferBody } = require('../services/providerPartnershipService');
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

async function attachPartnershipFromRequest(body) {
  const requestId = Number(body?.request_id);
  if (!Number.isFinite(requestId) || requestId <= 0) return body;
  const rows = await executeSQL('SELECT partnership_id FROM service_requests WHERE id = ? LIMIT 1', [requestId]);
  const request = Array.isArray(rows) ? rows[0] : rows;
  const partnershipId = Number(request?.partnership_id);
  if (!Number.isFinite(partnershipId) || partnershipId <= 0) {
    return { ...body, partnership_id: body.partnership_id ?? null };
  }
  return attachSplitToOfferBody(body, partnershipId);
}

async function prepareOfferBody(body) {
  const providerId = body?.provider_id;
  if (!providerId) return body;
  const provider = await loadProvider(providerId);
  if (!provider) throw new Error('Invalid provider_id');
  const priced = applyOfferFinancials(body, provider);
  return attachPartnershipFromRequest(priced);
}

/** Filters a non-admin may pass to the list endpoint. */
const LIST_FILTERS = ['request_id', 'provider_id', 'status'];

module.exports = {
  ...base,

  /**
   * List offers scoped to the caller (anti-IDOR). The generic CRUD getAll
   * served every offer of the platform (amounts, margins, clients) to any
   * authenticated account.
   *   admin    -> unrestricted (base behavior)
   *   provider -> only offers of their own provider profile
   *   client   -> only offers attached to their own service requests
   */
  getAll: async (req, res) => {
    try {
      if (isAdmin(req.user)) return base.getAll(req, res);

      const userId = req.user?.id != null ? Number(req.user.id) : null;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const conditions = [];
      const values = [];
      for (const key of LIST_FILTERS) {
        const v = req.query[key];
        if (v != null && v !== '') {
          conditions.push(`o.\`${key}\` = ?`);
          values.push(v);
        }
      }

      if (req.user?.role === 'provider') {
        const pid = await providerIdForUser(userId);
        if (pid == null) return res.json([]);
        conditions.push('o.provider_id = ?');
        values.push(pid);
      } else {
        // client (and any other role): own requests only. Legacy-safe client_id match.
        conditions.push('(r.client_id = ? OR r.client_id IN (SELECT id FROM clients WHERE user_id = ?))');
        values.push(userId, userId);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;
      const safeLimit = Number(req.query.limit) || 100;
      const safeOffset = Number(req.query.offset) || 0;
      const sql = `SELECT o.* FROM \`offers\` o
        JOIN \`service_requests\` r ON o.request_id = r.id
        ${where} ORDER BY o.\`created_at\` DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
      const rows = await executeSQL(sql, values);
      res.json(Array.isArray(rows) ? rows : []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Object-level authorization (anti-IDOR): only the owning provider, the
  // client of the request the offer answers, or an admin may read an offer.
  getOne: async (req, res) => {
    try {
      const row = await Offer.findById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      if (!isAdmin(req.user)) {
        const allowed =
          (await isOfferProvider(row, req.user?.id)) || (await isOfferClient(row, req.user?.id));
        if (!allowed) return res.status(403).json({ error: 'Forbidden' });
      }
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

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
