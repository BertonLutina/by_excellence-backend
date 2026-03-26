const Provider = require('../models/Provider');
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

  return { ok: true, data };
}

module.exports = {
  getAll: async (req, res) => {
    try {
      const { sort, limit, offset, tier, ...filters } = req.query;
      const tierFilter = parseTierFilter(tier);
      if (!tierFilter.ok) return res.status(400).json({ error: tierFilter.message });
      if (tierFilter.value !== undefined) filters.provider_tier = tierFilter.value;

      const rows = await Provider.findAll({ filters, sort, limit, offset });
      return res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  getOne: async (req, res) => {
    try {
      const row = await Provider.findById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json(row);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const normalized = normalizeProviderPayload(req.body, req);
      if (!normalized.ok) return res.status(normalized.status || 400).json({ error: normalized.message });

      const row = await Provider.create(normalized.data);
      return res.status(201).json(row);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const normalized = normalizeProviderPayload(req.body, req);
      if (!normalized.ok) return res.status(normalized.status || 400).json({ error: normalized.message });

      const row = await Provider.update(req.params.id, normalized.data);
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json(row);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      await Provider.delete(req.params.id);
      return res.json({ success: true, id: req.params.id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};
