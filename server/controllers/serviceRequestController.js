const createEntityController = require('./createEntityController');
const ServiceRequest = require('../models/ServiceRequest');
const { executeSQL } = require('../db/db');
const { bindJsonDocument } = require('../utils/portfolioImages');
const {
  normalizeProviderId,
  deriveIsCombo,
  validateComboForCreate,
} = require('../utils/serviceRequestCombo');
const { serializeServiceRequestRow, serializeServiceRequestRows } = require('../utils/serializeServiceRequest');

const SERVICE_REQUEST_STATUSES = new Set([
  'request_sent',
  'in_review',
  'offer_preparation',
  'offer_sent',
  'offer_accepted',
  'deposit_paid',
  'date_confirmed',
  'final_payment_pending',
  'completed',
  'cancelled',
]);

const base = createEntityController(ServiceRequest, 'ServiceRequest');

/** Enrich getOne with client_email (client_id = users.id for client). */
const getOne = async (req, res) => {
  try {
    const row = await ServiceRequest.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    let client_email = null;
    if (row.client_id) {
      const userResult = await executeSQL('SELECT email FROM users WHERE id = ?', [row.client_id]);
      const userRows = Array.isArray(userResult) ? userResult : userResult ? [userResult] : [];
      client_email = userRows[0]?.email ?? row.client_email ?? null;
    } else {
      client_email = row.client_email ?? null;
    }
    res.json(serializeServiceRequestRow({ ...row, client_email }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Map legacy frontend sort key to DB column (service_requests uses created_at, not created_date). */
function normalizeServiceRequestSort(sort) {
  if (sort === 'created_date' || sort === '-created_date') {
    return sort.startsWith('-') ? '-created_at' : 'created_at';
  }
  return sort;
}

/** Enrich getAll with client_email per row. */
const getAll = async (req, res) => {
  try {
    const { sort: rawSort, limit, offset, ...filters } = req.query;
    const sort = normalizeServiceRequestSort(rawSort);
    const rows = await ServiceRequest.findAll({ filters, sort, limit, offset });
    if (rows.length === 0) return res.json([]);
    const withEmail = await Promise.all(
      rows.map(async (r) => {
        let client_email = r.client_email ?? null;
        if (r.client_id) {
          const userResult = await executeSQL('SELECT email FROM users WHERE id = ?', [r.client_id]);
          const userRows = Array.isArray(userResult) ? userResult : userResult ? [userResult] : [];
          client_email = userRows[0]?.email ?? client_email;
        }
        return serializeServiceRequestRow({ ...r, client_email });
      })
    );
    res.json(withEmail);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

function parseComboPayloadBody(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return 'INVALID_JSON';
    }
  }
  return null;
}

const create = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const provider_id = normalizeProviderId(body.provider_id);
    if (!provider_id) {
      return res.status(400).json({ error: 'provider_id is required' });
    }
    const desc = body.service_description;
    if (desc === undefined || desc === null || String(desc).trim() === '') {
      return res.status(400).json({ error: 'service_description is required' });
    }

    const provRows = await executeSQL('SELECT id, display_name FROM providers WHERE id = ?', [provider_id]);
    const plist = Array.isArray(provRows) ? provRows : provRows ? [provRows] : [];
    if (plist.length === 0) {
      return res.status(400).json({ error: 'Invalid provider_id: provider not found' });
    }
    const primaryDisplay = plist[0].display_name;

    let client_id = null;
    let client_name = body.client_name != null ? String(body.client_name).trim() : null;
    let client_email = body.client_email != null ? String(body.client_email).trim() : null;

    if (req.user && req.user.role === 'client') {
      client_id = req.user.id;
      if (!client_name && req.user.full_name) client_name = String(req.user.full_name);
      if (!client_email) {
        const urows = await executeSQL('SELECT email FROM users WHERE id = ?', [client_id]);
        const u = Array.isArray(urows) ? urows[0] : urows;
        client_email = u?.email ?? null;
      }
    } else {
      // Guest, or logged-in provider/admin: store contact on the row; client_id stays null unless client above
      if (!client_email || !client_name) {
        return res.status(400).json({
          error: 'client_email and client_name are required',
        });
      }
    }

    const status = body.status != null ? String(body.status) : 'request_sent';
    if (!SERVICE_REQUEST_STATUSES.has(status)) {
      return res.status(400).json({ error: `Invalid status` });
    }

    let combo_payload = parseComboPayloadBody(body.combo_payload);
    if (combo_payload === 'INVALID_JSON') {
      return res.status(400).json({ error: 'combo_payload must be valid JSON' });
    }

    const is_combo = deriveIsCombo({ ...body, service_description: desc });
    const comboErr = await validateComboForCreate(is_combo, combo_payload);
    if (comboErr) {
      return res.status(400).json({ error: comboErr });
    }

    if (!is_combo) {
      combo_payload = null;
    }

    let comboForModel = null;
    if (is_combo && combo_payload != null && typeof combo_payload === 'object') {
      comboForModel = bindJsonDocument(combo_payload);
    }

    const provider_name =
      body.provider_name != null && String(body.provider_name).trim() !== ''
        ? String(body.provider_name).trim()
        : primaryDisplay || null;

    const row = await ServiceRequest.create({
      client_id,
      client_name,
      client_email,
      client_phone: body.client_phone != null ? String(body.client_phone) : null,
      provider_id,
      provider_name,
      service_description: String(desc),
      is_combo,
      combo_payload: comboForModel,
      preferred_date: body.preferred_date || null,
      budget: body.budget != null ? String(body.budget) : null,
      status,
    });

    let out = serializeServiceRequestRow(row);
    if (out.client_id) {
      const userResult = await executeSQL('SELECT email FROM users WHERE id = ?', [out.client_id]);
      const userRows = Array.isArray(userResult) ? userResult : userResult ? [userResult] : [];
      out = { ...out, client_email: userRows[0]?.email ?? out.client_email };
    }
    return res.status(201).json(out);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const update = async (req, res) => {
  try {
    const row = await ServiceRequest.update(req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(serializeServiceRequestRow(row));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  ...base,
  getOne,
  getAll,
  create,
  update,
};
