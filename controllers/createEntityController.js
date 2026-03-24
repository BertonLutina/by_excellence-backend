const { broadcast } = require('../websocket/wsServer');

/**
 * Enrich create payload with FKs from req.user when applicable (schema uses user/client id, not email).
 */
function enrichCreateData(entityName, req, data) {
  const user = req.user;
  if (!user || !user.id) return data;
  const out = { ...data };
  switch (entityName) {
    case 'ServiceRequest':
      if (out.client_id == null) out.client_id = user.id;
      break;
    case 'Message':
      if (out.sender_id == null) out.sender_id = user.id;
      break;
    case 'Review':
      if (out.client_id == null) out.client_id = user.id;
      break;
    case 'Favorite':
      if (out.client_id == null) out.client_id = user.id;
      break;
    default:
      break;
  }
  return out;
}

/**
 * Creates CRUD controller for a model. Model must expose async:
 * findAll(opts), findById(id), create(data), update(id, data), delete(id)
 */
const createEntityController = (model, entityName) => ({
  getAll: async (req, res) => {
    try {
      const { sort, limit, offset, ...filters } = req.query;
      const rows = await model.findAll({ filters, sort, limit, offset });
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getOne: async (req, res) => {
    try {
      const row = await model.findById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const data = enrichCreateData(entityName, req, req.body);
      const row = await model.create(data);
      broadcast({ event: `${entityName}:created`, data: row });
      res.status(201).json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const row = await model.update(req.params.id, req.body);
      if (!row) return res.status(404).json({ error: 'Not found' });
      broadcast({ event: `${entityName}:updated`, data: row });
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      await model.delete(req.params.id);
      broadcast({ event: `${entityName}:deleted`, data: { id: req.params.id } });
      res.json({ success: true, id: req.params.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
});

module.exports = createEntityController;
