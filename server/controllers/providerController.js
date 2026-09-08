const Provider = require('../models/Provider');
const { PortfolioImagesParseError } = require('../utils/portfolioImages');
const { serializeProviderRow, serializeProviderRows } = require('../utils/serializeProvider');
const { searchProviders } = require('../discovery/search');
const {
  computeProviderTier,
  isValidProviderTier,
} = require('../utils/providerTier');
const { isValidPremiumCommissionPercent } = require('../utils/commission');

const ACTIVITY_TYPES = new Set(['service', 'goods', 'both']);

function parseTierFilter(rawTier) {
  if (rawTier === undefined) return { ok: true, value: undefined };
  if (rawTier === null || rawTier === '') return { ok: true, value: null };
  if (!isValidProviderTier(rawTier)) {
    return { ok: false, message: "Invalid tier. Allowed values are 'standard' or 'premium'." };
  }
  return { ok: true, value: rawTier };
}

function normalizeProviderPayload(body = {}, req = null) {
  const data = { ...body };

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

  if (Object.prototype.hasOwnProperty.call(data, 'activity_type')) {
    data.activity_type = ACTIVITY_TYPES.has(data.activity_type) ? data.activity_type : 'service';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'suggested_category_type')) {
    data.suggested_category_type = ACTIVITY_TYPES.has(data.suggested_category_type)
      ? data.suggested_category_type
      : 'service';
  }

  if (Object.prototype.hasOwnProperty.call(data, 'suggested_category_name') && data.suggested_category_name != null) {
    data.suggested_category_name = String(data.suggested_category_name).trim().slice(0, 150);
  }

  delete data.structure_type;
  delete data.worker_count;

  return { ok: true, data };
}

function canManageProvider(user, provider) {
  if (user?.role === 'admin') return true;
  if (user?.role !== 'provider') return false;
  return provider?.user_id != null && Number(provider.user_id) === Number(user.id);
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
      if (!canManageProvider(req.user, existing)) return res.status(403).json({ error: 'Forbidden' });

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
      let is_verified = req.body?.is_verified;
      if (is_verified !== undefined && is_verified !== null) {
        if (typeof is_verified !== 'number') {
          return res.status(400).json({ error: "is_verified must be a number" });
        }
        is_verified = is_verified
      }
      else {
        is_verified = null;
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
      if (!canManageProvider(req.user, existing)) return res.status(403).json({ error: 'Forbidden' });
      await Provider.delete(req.params.id);
      return res.json({ success: true, id: req.params.id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};
