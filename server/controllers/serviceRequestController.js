const createEntityController = require('./createEntityController');
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const Client = require('../models/Client');
const { executeSQL } = require('../db/db');
const { bindJsonDocument } = require('../utils/portfolioImages');
const { sendMail, isMailConfigured } = require('../utils/mailer');
const { autoClientAccountEmail } = require('../utils/emailTemplates');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
  normalizeProviderId,
  deriveIsCombo,
  validateComboForCreate,
  normalizeComboPayload,
} = require('../utils/serviceRequestCombo');
const {
  validateAndNormalizeSelectedItems,
  buildDescriptionFromSelectedItems,
} = require('../utils/serviceRequestSelectedItems');
const { serializeServiceRequestRow, serializeServiceRequestRows } = require('../utils/serializeServiceRequest');
const {
  notifyRequestStatusChange,
  notifyComboRequestCreated,
} = require('../services/notificationService');
const {
  listCollaboratorsForRequest,
  syncCollaboratorsFromCombo,
  listRequestIdsForProvider,
} = require('../services/serviceRequestCollaborationService');
const { isAdmin, providerIdForUser, isRequestClient, pickFields } = require('../utils/entityAccess');
const { assertCanViewRequest } = require('./serviceRequestCollaboratorController');

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

const { resolveSortColumn } = require('../utils/sqlQueryGuards');

const REQUEST_SORT_COLUMNS = [
  'id', 'client_id', 'provider_id', 'status', 'created_at', 'updated_date', 'preferred_date',
];

/** Fields a client may change on their own request (accept an offer, cancel). */
const CLIENT_REQUEST_FIELDS = ['status'];
/** Statuses a client may set on their own request. */
const CLIENT_REQUEST_STATUSES = new Set(['offer_accepted', 'cancelled']);

const base = createEntityController(ServiceRequest, 'ServiceRequest');

const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

function pickLocale(req, body = {}) {
  const bodyLang = String(body.lang || body.locale || '').trim().toLowerCase();
  const headerLang = String(req?.headers?.['accept-language'] || '').toLowerCase();
  const source = bodyLang || headerLang;
  if (source.startsWith('nl')) return 'nl';
  if (source.startsWith('en')) return 'en';
  return 'fr';
}

function generateTempPassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  const bytes = crypto.randomBytes(len * 2);
  for (let i = 0; i < bytes.length && out.length < len; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

async function ensureClientForEmail({ email, name, phone, locale = 'fr' }) {
  const em = normalizeEmail(email);
  let user = await User.findByEmail(em);
  let createdPassword = null;

  if (!user) {
    createdPassword = generateTempPassword(12);
    const password_hash = await bcrypt.hash(createdPassword, 10);
    user = await User.create({
      email: em,
      password_hash,
      full_name: name || em,
      role: 'client',
    });

    sendMail({
      to: em,
      subject: 'Votre compte By Excellence African Services',
      html: autoClientAccountEmail({
        full_name: name || user.full_name || null,
        email: em,
        temp_password: createdPassword,
        locale,
      }),
    }).catch((err) => {
      console.error('[ServiceRequest auto-account] mail failed:', err.message);
    });
  }

  const uid = user?.id;
  if (!uid) throw new Error('Unable to create/link client user');

  const existingClient = await Client.findByUserId(uid);
  if (!existingClient) {
    await Client.create({
      user_id: uid,
      full_name: name || user.full_name || null,
      phone: phone || null,
      status: 'active',
    });
  }

  return { client_id: uid, createdPassword };
}

/** Enrich getOne with client_email (client_id = users.id for client). */
const getOne = async (req, res) => {
  try {
    const row = await ServiceRequest.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    // Object-level authorization (anti-IDOR): only the owning client, the
    // assigned or collaborating provider, or an admin may read the request.
    const canView =
      (await assertCanViewRequest(req, row)) || (await isRequestClient(row.id, req.user?.id));
    if (!canView) return res.status(403).json({ error: 'Forbidden' });
    let client_email = null;
    if (row.client_id) {
      const userResult = await executeSQL('SELECT email FROM users WHERE id = ?', [row.client_id]);
      const userRows = Array.isArray(userResult) ? userResult : userResult ? [userResult] : [];
      client_email = userRows[0]?.email ?? row.client_email ?? null;
    } else {
      client_email = row.client_email ?? null;
    }
    res.json(serializeServiceRequestRow({ ...row, client_email, collaborators: await listCollaboratorsForRequest(row.id) }));
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
    const { sort: rawSort, limit, offset, provider_id: providerIdFilter, ...filters } = req.query;
    const sort = normalizeServiceRequestSort(rawSort);

    let rows;

    // Anti-IDOR: only an admin runs an unscoped / arbitrary-filter list. Every
    // other caller is forced onto the requests they own, ignoring a spoofed
    // ?client_id= / ?provider_id=. Without this the list served every request of
    // the platform (client_email, budget, combo_payload) to any logged-in account.
    let providerScope = providerIdFilter;
    if (!isAdmin(req.user)) {
      const callerId = req.user?.id != null ? Number(req.user.id) : null;
      if (!callerId) return res.status(401).json({ error: 'Unauthorized' });

      if (req.user.role === 'provider') {
        const ownPid = await providerIdForUser(callerId);
        if (ownPid == null) return res.json([]);
        providerScope = ownPid; // force self, whatever ?provider_id= was passed
      } else {
        // client (and any other non-privileged role): own requests only,
        // legacy-safe for client_id pointing at clients.id instead of users.id.
        const { sortCol, sortDir } = resolveSortColumn(sort, 'DESC', REQUEST_SORT_COLUMNS);
        const safeLimit = Number(limit) || 100;
        const safeOffset = Number(offset) || 0;
        rows = await executeSQL(
          `SELECT * FROM service_requests
           WHERE client_id = ? OR client_id IN (SELECT id FROM clients WHERE user_id = ?)
           ORDER BY \`${sortCol}\` ${sortDir} LIMIT ${safeLimit} OFFSET ${safeOffset}`,
          [callerId, callerId]
        );
      }
    }

    if (rows === undefined) {
      const pid = normalizeProviderId(providerScope);
      if (pid) {
        const ids = await listRequestIdsForProvider(pid);
        if (!ids.length) return res.json([]);
        const placeholders = ids.map(() => '?').join(',');
        const { sortCol, sortDir } = resolveSortColumn(sort, 'DESC', REQUEST_SORT_COLUMNS);
        const safeLimit = Number(limit) || 100;
        const safeOffset = Number(offset) || 0;
        rows = await executeSQL(
          `SELECT * FROM service_requests WHERE id IN (${placeholders})
           ORDER BY \`${sortCol}\` ${sortDir} LIMIT ${safeLimit} OFFSET ${safeOffset}`,
          ids
        );
      } else {
        rows = await ServiceRequest.findAll({ filters, sort, limit, offset });
      }
    }

    if (rows.length === 0) return res.json([]);
    const withEmail = await Promise.all(
      rows.map(async (r) => {
        let client_email = r.client_email ?? null;
        if (r.client_id) {
          const userResult = await executeSQL('SELECT email FROM users WHERE id = ?', [r.client_id]);
          const userRows = Array.isArray(userResult) ? userResult : userResult ? [userResult] : [];
          client_email = userRows[0]?.email ?? client_email;
        }
        const collaborators = await listCollaboratorsForRequest(r.id);
        return serializeServiceRequestRow({ ...r, client_email, collaborators });
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
    const locale = pickLocale(req, body);
    const isOpenRequest = body.is_open_request === true || body.is_open_request === 'true';

    let provider_id = normalizeProviderId(body.provider_id);
    if (isOpenRequest) {
      provider_id = null;
    } else if (!provider_id) {
      return res.status(400).json({ error: 'provider_id is required' });
    }

    const { items: selectedItems, error: itemsErr } = await validateAndNormalizeSelectedItems(
      provider_id,
      body.selected_items
    );
    if (itemsErr) {
      return res.status(400).json({ error: itemsErr });
    }

    if (isOpenRequest && selectedItems.length > 0) {
      return res.status(400).json({ error: 'Open requests cannot include selected_items' });
    }

    let combo_payload = parseComboPayloadBody(body.combo_payload);
    if (combo_payload === 'INVALID_JSON') {
      return res.status(400).json({ error: 'combo_payload must be valid JSON' });
    }

    const is_combo = isOpenRequest ? false : deriveIsCombo({ ...body, service_description: body.service_description });
    if (is_combo && selectedItems.length > 0) {
      return res.status(400).json({ error: 'Cannot combine combo request with selected_items basket' });
    }
    if (isOpenRequest && (is_combo || body.is_combo === true || body.is_combo === 'true')) {
      return res.status(400).json({ error: 'Open requests cannot be combo requests' });
    }

    if (is_combo && combo_payload) {
      combo_payload = normalizeComboPayload(combo_payload, provider_id);
      if (!combo_payload) {
        return res.status(400).json({ error: 'Invalid combo_payload: at least 2 providers required' });
      }
    }

    let desc = body.service_description;
    const descTrim = desc != null ? String(desc).trim() : '';
    const userNotes = descTrim;

    if (selectedItems.length > 0 && !descTrim) {
      desc = buildDescriptionFromSelectedItems(selectedItems, '');
    } else if (selectedItems.length > 0 && descTrim) {
      desc = buildDescriptionFromSelectedItems(selectedItems, userNotes);
    }

    if (desc === undefined || desc === null || String(desc).trim() === '') {
      return res.status(400).json({ error: 'service_description is required' });
    }

    const provRows = provider_id
      ? await executeSQL('SELECT id, display_name FROM providers WHERE id = ?', [provider_id])
      : [];
    const plist = Array.isArray(provRows) ? provRows : provRows ? [provRows] : [];
    if (provider_id && plist.length === 0) {
      return res.status(400).json({ error: 'Invalid provider_id: provider not found' });
    }
    const primaryDisplay = plist[0]?.display_name;

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
      const linked = await ensureClientForEmail({
        email: client_email,
        name: client_name,
        phone: body.client_phone != null ? String(body.client_phone) : null,
        locale,
      });
      client_id = linked.client_id;
      if (linked.createdPassword && !isMailConfigured()) {
        console.warn('[ServiceRequest auto-account] SMTP not configured; account created without email send');
      }
    }

    const status = body.status != null ? String(body.status) : 'request_sent';
    if (!SERVICE_REQUEST_STATUSES.has(status)) {
      return res.status(400).json({ error: `Invalid status` });
    }

    const is_combo_final = deriveIsCombo({ ...body, service_description: desc, is_combo });
    const comboErr = await validateComboForCreate(is_combo_final, combo_payload, provider_id);
    if (comboErr) {
      return res.status(400).json({ error: comboErr });
    }

    if (!is_combo_final) {
      combo_payload = null;
    }

    let comboForModel = null;
    if (is_combo_final && combo_payload != null && typeof combo_payload === 'object') {
      comboForModel = bindJsonDocument(combo_payload);
    }

    let selectedForModel = null;
    if (selectedItems.length > 0) {
      selectedForModel = bindJsonDocument(selectedItems);
    }

    const provider_name = isOpenRequest
      ? 'À assigner'
      : body.provider_name != null && String(body.provider_name).trim() !== ''
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
      is_combo: is_combo_final,
      is_open_request: isOpenRequest,
      combo_payload: comboForModel,
      selected_items: selectedForModel,
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

    if (is_combo_final && combo_payload?.lines?.length) {
      await syncCollaboratorsFromCombo(out.id, combo_payload, { fromClient: true });
      out.collaborators = await listCollaboratorsForRequest(out.id);
      notifyComboRequestCreated(out).catch((e) => {
        console.warn('[ServiceRequest create] combo notify failed:', e.message);
      });
    }
    notifyRequestStatusChange(out.id, out.status).catch((e) => {
      console.warn('[ServiceRequest create] notify failed:', e.message);
    });

    return res.status(201).json(out);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const update = async (req, res) => {
  try {
    const before = await ServiceRequest.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });

    let body = req.body && typeof req.body === 'object' ? { ...req.body } : {};

    // Object-level authorization (anti-IDOR): only an admin or the owning client
    // may update the request, and a client is limited to accepting an offer or
    // cancelling. The assigned provider has no update path here.
    if (!isAdmin(req.user)) {
      if (!(await isRequestClient(before.id, req.user?.id))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const [filtered, rejected] = pickFields(body, CLIENT_REQUEST_FIELDS);
      if (rejected.length) {
        return res.status(403).json({ error: `Clients cannot modify: ${rejected.join(', ')}` });
      }
      if (filtered.status != null && !CLIENT_REQUEST_STATUSES.has(filtered.status)) {
        return res.status(403).json({ error: 'Clients can only accept an offer or cancel' });
      }
      body = filtered;
    }

    const row = await ServiceRequest.update(req.params.id, body);
    if (!row) return res.status(404).json({ error: 'Not found' });

    if (body?.status && before?.status && before.status !== row.status) {
      notifyRequestStatusChange(row.id, row.status).catch((e) => {
        console.warn('[ServiceRequest update] notify failed:', e.message);
      });
    }

    return res.json(serializeServiceRequestRow(row));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Object-level authorization (anti-IDOR): remove was falling through to the raw
// createEntityController.remove, letting any authenticated account delete any
// request. Only an admin or the owning client may delete.
const remove = async (req, res) => {
  try {
    const before = await ServiceRequest.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });
    if (!isAdmin(req.user) && !(await isRequestClient(before.id, req.user?.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return base.remove(req, res);
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
  remove,
};
