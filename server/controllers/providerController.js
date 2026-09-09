const Provider = require('../models/Provider');
const { PortfolioImagesParseError } = require('../utils/portfolioImages');
const { serializeProviderRow, serializeProviderRows } = require('../utils/serializeProvider');
const { searchProviders } = require('../discovery/search');
const {
  computeProviderTier,
  isValidProviderTier,
} = require('../utils/providerTier');
const { isValidPremiumCommissionPercent } = require('../utils/commission');

function parseTierFilter(rawTier) {
  if (rawTier === undefined) return { ok: true, value: undefined };
  if (rawTier === null || rawTier === '') return { ok: true, value: null };
  if (!isValidProviderTier(rawTier)) {
    return { ok: false, message: "Invalid tier. Allowed values are 'standard' or 'premium'." };
  }
  return { ok: true, value: rawTier };
}

// Stripe Connect fields are only ever written by server-side controllers
// (stripeConnectController) or the account.updated webhook — never by client
// request bodies. Stripping them here prevents mass-assignment: without this,
// any authenticated caller who could reach this endpoint could rewrite a
// provider's stripe_account_id and redirect their future payouts.
const STRIPE_CONNECT_FIELDS = [
  'stripe_account_id',
  'stripe_connect_status',
  'stripe_payouts_enabled',
  'stripe_connect_requested_at',
];

function normalizeProviderPayload(body = {}, req = null) {
  const data = { ...body };
  for (const field of STRIPE_CONNECT_FIELDS) delete data[field];

  if (Object.prototype.hasOwnProperty.call(data, 'premium_commission_percent')) {
    if (!req || req.user?.role !== 'admin') {
      return { ok: false, status: 403, message: 'Only admins can set premium_commission_percent' };
    }
    const p = Number(data.premium_commission_percent);
    if (!isValidPremiumCommissionPercent(p)) {
      return { ok: false, message: 'premium_commission_percent must be 20 or 30' };
    }
    data.premium_commission_percent = p;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'provider_tier') && data.provider_tier !== null && !isValidProviderTier(data.provider_tier)) {
    return {
      ok: false,
      message: "Invalid provider_tier. Allowed values are 'standard' or 'premium'.",
    };
  }

  if (Object.prototype.hasOwnProperty.call(data, 'price_from')) {
    data.provider_tier = computeProviderTier(data.price_from);
  }

  delete data.structure_type;
  delete data.worker_count;

  return { ok: true, data };
}

/** Solo (1 person) vs team; worker_count is headcount on the job (1 solo, ≥2 team). */
function normalizeStructureForWrite(body = {}, existingRow = null) {
  const hasSt = Object.prototype.hasOwnProperty.call(body, 'structure_type');
  const hasWc = Object.prototype.hasOwnProperty.call(body, 'worker_count');
  if (!hasSt && !hasWc) {
    if (!existingRow) return { ok: true, data: { structure_type: 'solo', worker_count: 1 } };
    return { ok: true, data: {} };
  }
  const st = hasSt ? String(body.structure_type) : existingRow?.structure_type || 'solo';
  if (st !== 'solo' && st !== 'team') {
    return { ok: false, message: "structure_type must be 'solo' or 'team'" };
  }
  let n;
  if (hasWc && body.worker_count !== '' && body.worker_count != null) {
    n = parseInt(body.worker_count, 10);
    if (!Number.isFinite(n) || n < 1 || n > 500) {
      return { ok: false, message: 'worker_count must be between 1 and 500' };
    }
  } else if (st === 'solo') {
    n = 1;
  } else {
    const prev = existingRow?.worker_count != null ? parseInt(existingRow.worker_count, 10) : NaN;
    n = Number.isFinite(prev) && prev >= 2 ? prev : 2;
  }
  if (st === 'solo') n = 1;
  if (st === 'team' && n < 2) {
    return { ok: false, message: 'For a team, worker_count must be at least 2' };
  }
  return { ok: true, data: { structure_type: st, worker_count: n } };
}

module.exports = {
  getAll: async (req, res) => {
    try {
      const { sort, limit, offset, tier, include_total, ...filters } = req.query;
      const tierFilter = parseTierFilter(tier);
      if (!tierFilter.ok) return res.status(400).json({ error: tierFilter.message });
      if (tierFilter.value !== undefined) filters.provider_tier = tierFilter.value;

      const rawLimit = Number(limit) || 100;
      const safeLimit = Math.min(Math.max(rawLimit, 1), 500);
      const safeOffset = Math.max(0, parseInt(offset, 10) || 0);
      const rows = await Provider.findAll({ filters, sort, limit: safeLimit, offset: safeOffset });
      const payload = serializeProviderRows(rows);
      const wantTotal = include_total === '1' || include_total === 'true';
      if (wantTotal) {
        const total = await Provider.countAll({ filters });
        return res.json({ items: payload, total });
      }
      return res.json(payload);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  getOne: async (req, res) => {
    try {
      const row = await Provider.findById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json(serializeProviderRow(row));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Discovery: relevance-ranked search with optional "near me" geo + filters.
  search: async (req, res) => {
    try {
      const q = req.query || {};
      const num = (v) => (v == null || v === '' ? undefined : Number(v));
      const bool = (v) => v === 'true' || v === '1';

      const near =
        num(q.lat) != null && num(q.lng) != null && num(q.radius_km) != null
          ? { lat: num(q.lat), lng: num(q.lng), radiusKm: num(q.radius_km) }
          : undefined;

      const criteria = {
        query: q.query || q.q || undefined,
        categoryId: num(q.category_id),
        city: q.city || undefined,
        tier: q.tier || undefined,
        verifiedOnly: bool(q.verified),
        minRating: num(q.min_rating),
        priceMin: num(q.price_min),
        priceMax: num(q.price_max),
        near,
        limit: Math.min(Math.max(num(q.limit) || 50, 1), 200),
      };

      // Load candidates (active providers) and rank in-memory. As the catalog
      // grows, push the equality filters into Provider.findAll and rank the rest.
      const rows = await Provider.findAll({ filters: { status: 'active' }, limit: 1000 });
      const ranked = searchProviders(rows, criteria);
      // Serialize each row but keep the ranking fields the search added.
      const items = ranked.map((p) => ({
        ...serializeProviderRow(p),
        _score: p._score,
        ...(p._distanceKm != null ? { _distanceKm: p._distanceKm } : {}),
      }));
      return res.json({ items, count: ranked.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      // Prevent registering a provider profile under someone else's user_id.
      // The signup form always sends the caller's own id; only admins may set
      // a different one (e.g. back-office provider creation on someone's behalf).
      const requestedUserId = req.body?.user_id;
      if (req.user?.role !== 'admin') {
        if (requestedUserId != null && String(requestedUserId) !== String(req.user?.id)) {
          return res.status(403).json({ error: 'Cannot create a provider profile for another user' });
        }
        req.body.user_id = req.user?.id;
      }

      const normalized = normalizeProviderPayload(req.body, req);
      if (!normalized.ok) return res.status(normalized.status || 400).json({ error: normalized.message });

      const struct = normalizeStructureForWrite(req.body, null);
      if (!struct.ok) return res.status(400).json({ error: struct.message });

      const row = await Provider.create({ ...normalized.data, ...struct.data });
      return res.status(201).json(serializeProviderRow(row));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const existing = await Provider.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });

      // IDOR guard: only the provider's own owner or an admin may edit this
      // row. The generic PUT /:id endpoint previously had no ownership check
      // at all — any authenticated user could edit any other provider's
      // profile (siret, price_from, bank/legal fields, ...).
      const isOwner = req.user?.id != null && String(existing.user_id) === String(req.user.id);
      if (!isOwner && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const normalized = normalizeProviderPayload(req.body, req);
      if (!normalized.ok) return res.status(normalized.status || 400).json({ error: normalized.message });

      const struct = normalizeStructureForWrite(req.body, existing);
      if (!struct.ok) return res.status(400).json({ error: struct.message });

      const row = await Provider.update(req.params.id, { ...normalized.data, ...struct.data });
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json(serializeProviderRow(row));
    } catch (err) {
      if (err instanceof PortfolioImagesParseError) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  },

  updateStatus: async (req, res) => {
    try {
      const status = req.body?.status;
      if (!['active', 'inactive', 'pending'].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Allowed values: active, inactive, pending" });
      }
      const existing = await Provider.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      const row = await Provider.update(req.params.id, { status });
      return res.json(serializeProviderRow(row));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  updateVerified: async (req, res) => {
    try {
      // Accept boolean (what the admin UI sends), 0/1 numbers, and the string
      // forms ("1", "true", ...). The column is BOOLEAN/TINYINT(1), so we
      // normalise everything to 0 / 1 before writing.
      const raw = req.body?.is_verified;
      let is_verified;
      if (raw === undefined || raw === null) {
        is_verified = null;
      } else if (typeof raw === 'boolean') {
        is_verified = raw ? 1 : 0;
      } else if (typeof raw === 'number' && (raw === 0 || raw === 1)) {
        is_verified = raw;
      } else if (raw === '1' || raw === 'true') {
        is_verified = 1;
      } else if (raw === '0' || raw === 'false') {
        is_verified = 0;
      } else {
        return res.status(400).json({ error: 'is_verified must be a boolean (or 0/1)' });
      }
      const existing = await Provider.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      const row = await Provider.update(req.params.id, { is_verified });
      return res.json(serializeProviderRow(row));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

    remove: async (req, res) => {
    try {
      const existing = await Provider.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });

      // IDOR guard: same rule as update() above. The 02/07/2026 fix on update()
      // was never propagated here — DELETE /providers/:id had no ownership
      // check at all, so any authenticated account (a client, another
      // provider) could delete any provider profile.
      const isOwner = req.user?.id != null && String(existing.user_id) === String(req.user.id);
      if (!isOwner && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await Provider.delete(req.params.id);
      return res.json({ success: true, id: req.params.id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};
