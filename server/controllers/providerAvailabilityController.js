const createEntityController = require('./createEntityController');
const ProviderAvailability = require('../models/ProviderAvailability');
const { executeSQL } = require('../db/db');
const {
  coerceAvailable,
  normalizeProgramNote,
  sanitizeAvailabilityRow,
} = require('../utils/providerAvailabilityPublic');

const base = createEntityController(ProviderAvailability, 'ProviderAvailability');

async function providerIdForUser(userId) {
  const rows = await executeSQL('SELECT id FROM providers WHERE user_id = ? LIMIT 1', [userId]);
  const r = Array.isArray(rows) ? rows[0] : rows;
  return r?.id ? Number(r.id) : null;
}

async function assertProviderOwnsRow(req, row) {
  if (!row) return false;
  if (req.user?.role === 'admin') return true;
  if (req.user?.role !== 'provider') return false;
  const pid = await providerIdForUser(req.user.id);
  return pid != null && Number(row.provider_id) === pid;
}

async function viewerProviderId(req) {
  if (req.user?.role !== 'provider') return null;
  return providerIdForUser(req.user.id);
}

function canSeeProgram(req, row, viewerPid) {
  if (req.user?.role === 'admin') return true;
  return viewerPid != null && row && Number(row.provider_id) === viewerPid;
}

function prepareAvailabilityBody(body, { fallbackAvailable = true } = {}) {
  const data = { ...body };
  if (Object.prototype.hasOwnProperty.call(body || {}, 'is_available')) {
    data.is_available = coerceAvailable(body.is_available, fallbackAvailable);
  } else {
    data.is_available = coerceAvailable(body?.is_available, fallbackAvailable);
  }
  if (Object.prototype.hasOwnProperty.call(body || {}, 'program_note')) {
    data.program_note = normalizeProgramNote(body.program_note);
  }
  return data;
}

module.exports = {
  ...base,

  getAll: async (req, res) => {
    try {
      const { sort, limit, offset, include_total, ...filters } = req.query;
      void include_total;
      const rows = await ProviderAvailability.findAll({ filters, sort, limit, offset });
      const viewerPid = await viewerProviderId(req);
      const list = Array.isArray(rows) ? rows : [];
      res.json(list.map((row) => sanitizeAvailabilityRow(row, {
        canSeeProgram: canSeeProgram(req, row, viewerPid),
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getOne: async (req, res) => {
    try {
      const row = await ProviderAvailability.findById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      const viewerPid = await viewerProviderId(req);
      res.json(sanitizeAvailabilityRow(row, {
        canSeeProgram: canSeeProgram(req, row, viewerPid),
      }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const data = prepareAvailabilityBody(req.body, { fallbackAvailable: true });
      if (req.user?.role === 'provider') {
        const pid = await providerIdForUser(req.user.id);
        if (!pid) return res.status(403).json({ error: 'Forbidden' });
        data.provider_id = pid;
      }
      if (!data.provider_id) {
        return res.status(400).json({ error: 'provider_id is required' });
      }
      if (!data.slot_date) {
        return res.status(400).json({ error: 'slot_date is required' });
      }
      const row = await ProviderAvailability.create(data);
      res.status(201).json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const existing = await ProviderAvailability.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (!(await assertProviderOwnsRow(req, existing))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const row = await ProviderAvailability.update(
        req.params.id,
        prepareAvailabilityBody(req.body, { fallbackAvailable: coerceAvailable(existing.is_available, true) })
      );
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const existing = await ProviderAvailability.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (!(await assertProviderOwnsRow(req, existing))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      await ProviderAvailability.delete(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
