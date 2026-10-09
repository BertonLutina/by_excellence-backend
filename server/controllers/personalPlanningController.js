const PersonalPlanningItem = require('../models/PersonalPlanningItem');
const {
  canUsePersonalPlanning,
  sanitizePlanningPayload,
} = require('../utils/personalPlanning');

function forbidUnlessAllowed(req, res) {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (!canUsePersonalPlanning(req.user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

function ownsRow(req, row) {
  return row && Number(row.user_id) === Number(req.user.id);
}

module.exports = {
  getAll: async (req, res) => {
    try {
      if (!forbidUnlessAllowed(req, res)) return;
      const { sort, limit, offset, include_total, ...filters } = req.query;
      void include_total;
      const rows = await PersonalPlanningItem.findAll({
        filters: { ...filters, user_id: req.user.id },
        sort: sort || '-plan_date',
        limit,
        offset,
      });
      res.json(Array.isArray(rows) ? rows : []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getOne: async (req, res) => {
    try {
      if (!forbidUnlessAllowed(req, res)) return;
      const row = await PersonalPlanningItem.findById(req.params.id);
      if (!row || !ownsRow(req, row)) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      if (!forbidUnlessAllowed(req, res)) return;
      const parsed = sanitizePlanningPayload(req.body, { partial: false });
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const row = await PersonalPlanningItem.create({
        ...parsed.data,
        user_id: req.user.id,
        is_done: parsed.data.is_done ?? false,
      });
      res.status(201).json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      if (!forbidUnlessAllowed(req, res)) return;
      const existing = await PersonalPlanningItem.findById(req.params.id);
      if (!existing || !ownsRow(req, existing)) return res.status(404).json({ error: 'Not found' });
      const parsed = sanitizePlanningPayload(req.body, { partial: true });
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const { user_id: _ignored, ...safe } = parsed.data;
      void _ignored;
      const row = await PersonalPlanningItem.update(req.params.id, safe);
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      if (!forbidUnlessAllowed(req, res)) return;
      const existing = await PersonalPlanningItem.findById(req.params.id);
      if (!existing || !ownsRow(req, existing)) return res.status(404).json({ error: 'Not found' });
      await PersonalPlanningItem.delete(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
