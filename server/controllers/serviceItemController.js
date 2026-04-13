const ServiceItem = require('../models/ServiceItem');

function parseIncludes(raw) {
  if (Array.isArray(raw)) return raw.filter((x) => String(x || '').trim() !== '');
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.filter((x) => String(x || '').trim() !== '') : [];
    } catch {
      return [s];
    }
  }
  return [];
}

function serialize(row) {
  if (!row) return row;
  const includes = parseIncludes(row.includes);
  return {
    ...row,
    name: row.title,
    includes,
  };
}

function toModelPayload(body = {}, req) {
  const out = { ...body };

  if (out.name != null && out.title == null) out.title = out.name;
  if (out.title != null) out.title = String(out.title).trim();

  if (Object.prototype.hasOwnProperty.call(out, 'includes')) {
    out.includes = JSON.stringify(parseIncludes(out.includes));
  }

  if (out.price != null && out.price !== '') {
    const n = Number(out.price);
    if (Number.isFinite(n)) out.price = n;
  }

  if (out.order != null && out.order !== '') {
    const n = parseInt(out.order, 10);
    if (Number.isFinite(n)) out.order = n;
  }

  if (out.is_active === undefined) out.is_active = 1;
  if (out.created_by === undefined && req?.user?.id != null) out.created_by = req.user.id;

  delete out.name;
  return out;
}

module.exports = {
  getAll: async (req, res) => {
    try {
      const { sort, limit, offset, include_total, ...filters } = req.query;
      void include_total;
      const rows = await ServiceItem.findAll({ filters, sort, limit, offset });
      return res.json((rows || []).map(serialize));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  getOne: async (req, res) => {
    try {
      const row = await ServiceItem.findById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json(serialize(row));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const payload = toModelPayload(req.body, req);
      console.log(payload);
      const row = await ServiceItem.create(payload);
      return res.status(201).json(serialize(row));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const payload = toModelPayload(req.body, req);
      const row = await ServiceItem.update(req.params.id, payload);
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json(serialize(row));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      await ServiceItem.delete(req.params.id);
      return res.json({ success: true, id: req.params.id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};
