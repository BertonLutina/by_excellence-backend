const createEntityController = require('./createEntityController');
const Favorite = require('../models/Favorite');
const { isAdmin } = require('../utils/entityAccess');

const base = createEntityController(Favorite, 'Favorite');

/** Favorites are strictly personal: every operation is scoped to the caller (admins excepted). */
module.exports = {
  ...base,

  getAll: async (req, res) => {
    if (!isAdmin(req.user)) req.query.client_id = String(req.user?.id ?? '');
    return base.getAll(req, res);
  },

  // Composite id: "clientId_providerId" — the client part must be the caller.
  getOne: async (req, res) => {
    if (!isAdmin(req.user)) {
      const [clientId] = String(req.params.id || '').split('_');
      if (String(req.user?.id) !== String(clientId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    return base.getOne(req, res);
  },

  update: async (req, res) => {
    if (!isAdmin(req.user)) {
      const [clientId] = String(req.params.id || '').split('_');
      if (String(req.user?.id) !== String(clientId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      // A client may never reassign a favorite to another client.
      const body = { ...(req.body || {}) };
      delete body.client_id;
      req.body = body;
    }
    return base.update(req, res);
  },

  create: async (req, res) => {
    const body = { ...(req.body || {}) };
    if (!isAdmin(req.user)) body.client_id = req.user?.id;
    req.body = body;
    return base.create(req, res);
  },

  remove: async (req, res) => {
    // Composite id: "clientId_providerId" — the client part must be the caller.
    if (!isAdmin(req.user)) {
      const [clientId] = String(req.params.id || '').split('_');
      if (String(req.user?.id) !== String(clientId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    return base.remove(req, res);
  },
};
