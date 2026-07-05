const createEntityController = require('./createEntityController');
const ProviderAvailability = require('../models/ProviderAvailability');
const { executeSQL } = require('../db/db');

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

module.exports = {
  ...base,

  create: async (req, res) => {
    try {
      const data = { ...req.body, is_available: req.body.is_available ?? true };
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
      const row = await ProviderAvailability.update(req.params.id, req.body);
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
