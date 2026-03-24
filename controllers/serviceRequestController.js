const createEntityController = require('./createEntityController');
const ServiceRequest = require('../models/ServiceRequest');
const { executeSQL } = require('../db/db');

const base = createEntityController(ServiceRequest, 'ServiceRequest');

/** Enrich getOne with client_email (client_id = users.id for client). */
const getOne = async (req, res) => {
  try {
    const row = await ServiceRequest.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const userResult = await executeSQL(
      'SELECT email FROM users WHERE id = ?',
      [row.client_id]
    );
    const userRows = Array.isArray(userResult) ? userResult : (userResult ? [userResult] : []);
    const client_email = userRows[0]?.email ?? null;
    res.json({ ...row, client_email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Enrich getAll with client_email per row. */
const getAll = async (req, res) => {
  try {
    const { sort, limit, offset, ...filters } = req.query;
    const rows = await ServiceRequest.findAll({ filters, sort, limit, offset });
    if (rows.length === 0) return res.json([]);
    const ids = [...new Set(rows.map((r) => r.client_id).filter(Boolean))];
    if (ids.length === 0) return res.json(rows.map((r) => ({ ...r, client_email: null })));
    const placeholders = ids.map(() => '?').join(',');
    const userResult = await executeSQL(
      `SELECT id, email FROM users WHERE id IN (${placeholders})`,
      ids
    );
    const userList = Array.isArray(userResult) ? userResult : (userResult ? [userResult] : []);
    const emailByUserId = Object.fromEntries(userList.map((u) => [u.id, u.email]));
    const enriched = rows.map((r) => ({ ...r, client_email: emailByUserId[r.client_id] ?? null }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { ...base, getOne, getAll };
