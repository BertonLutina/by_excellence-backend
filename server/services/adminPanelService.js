const { executeSQL } = require('../db/db');
const Client = require('../models/Client');
const Provider = require('../models/Provider');
const Admin = require('../models/Admin');
const { serializeProviderRow, serializeProviderRows } = require('../utils/serializeProvider');

const ALLOWED_STATUS = new Set(['active', 'inactive', 'pending']);

function parsePagination(query = {}) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 200);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  return { limit, offset };
}

function ensureStatus(status) {
  if (!ALLOWED_STATUS.has(status)) {
    const err = new Error("Invalid status. Allowed values: active, inactive, pending");
    err.status = 400;
    throw err;
  }
}

async function listClients(query) {
  const { limit, offset } = parsePagination(query);
  const rows = await executeSQL(
    `SELECT c.id, c.user_id, c.full_name, c.phone, c.status, c.created_at, c.updated_date,
            u.email, u.is_email_verified
     FROM clients c
     LEFT JOIN users u ON u.id = c.user_id
     ORDER BY c.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return Array.isArray(rows) ? rows : [];
}

async function getClientById(id) {
  const rows = await executeSQL(
    `SELECT c.id, c.user_id, c.full_name, c.phone, c.status, c.created_at, c.updated_date,
            u.email, u.is_email_verified
     FROM clients c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
    [id]
  );
  const arr = Array.isArray(rows) ? rows : [];
  return arr[0] || null;
}

async function updateClientStatus(id, status) {
  ensureStatus(status);
  await Client.update(id, { status });
  return Client.findById(id);
}

async function getClientDemandes(clientId) {
  // The admin panel passes clients.id, but service_requests.client_id can be:
  //  - clients.user_id (schema-correct, JWT-based inserts), OR
  //  - clients.id (legacy data inserted via a different path), OR
  //  - matched by client_email when client_id is NULL
  // We resolve all three paths and merge the results, deduping by sr.id.
  // This makes the endpoint resilient to data inconsistencies.

  // Lookup the client row first to know both ids and email.
  const clientRows = await executeSQL(
    `SELECT c.id, c.user_id, u.email
     FROM clients c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
    [clientId]
  );
  const clientArr = Array.isArray(clientRows) ? clientRows : [];
  const client = clientArr[0];
  if (!client) return [];

  const userId = client.user_id;
  const email = client.email;
  // Note: service_requests uses `created_at` (not `created_date`).
  // We expose it as `created_date` to keep the frontend contract stable.
  const SELECT_CLAUSE = `
    SELECT sr.id,
           sr.client_id,
           sr.status,
           sr.service_description AS description,
           sr.created_at AS created_date,
           sr.updated_date,
           sr.client_email
    FROM service_requests sr
  `;

  const queries = [];
  if (userId != null) {
    queries.push(executeSQL(`${SELECT_CLAUSE} WHERE sr.client_id = ?`, [userId]));
  }
  queries.push(executeSQL(`${SELECT_CLAUSE} WHERE sr.client_id = ?`, [clientId]));
  if (email) {
    queries.push(executeSQL(`${SELECT_CLAUSE} WHERE sr.client_id IS NULL AND sr.client_email = ?`, [email]));
  }

  const all = await Promise.all(queries);
  const map = new Map();
  for (const set of all) {
    const arr = Array.isArray(set) ? set : [];
    for (const row of arr) {
      if (!map.has(row.id)) map.set(row.id, row);
    }
  }
  const merged = [...map.values()].sort((a, b) => {
    const ta = new Date(a.created_date || 0).getTime();
    const tb = new Date(b.created_date || 0).getTime();
    return tb - ta;
  });

  // eslint-disable-next-line no-console
  console.log('[getClientDemandes] resilient resolve', {
    clientId,
    userId,
    email,
    foundByUserId: all[0] ? (Array.isArray(all[0]) ? all[0].length : 0) : 0,
    foundByClientId: (Array.isArray(all[userId != null ? 1 : 0]) ? all[userId != null ? 1 : 0].length : 0),
    foundByEmail: email && all[all.length - 1] ? (Array.isArray(all[all.length - 1]) ? all[all.length - 1].length : 0) : 0,
    totalReturned: merged.length,
  });

  return merged;
}

async function listProviders(query) {
  const { limit, offset } = parsePagination(query);
  const rows = await executeSQL(
    `SELECT p.*, u.email, u.is_email_verified
     FROM providers p
     LEFT JOIN users u ON u.id = p.user_id
     ORDER BY p.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return serializeProviderRows(Array.isArray(rows) ? rows : []);
}

async function getProviderById(id) {
  const rows = await executeSQL(
    `SELECT p.*, u.email, u.is_email_verified
     FROM providers p
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = ?`,
    [id]
  );
  const arr = Array.isArray(rows) ? rows : [];
  return arr[0] ? serializeProviderRow(arr[0]) : null;
}

async function updateProviderStatus(id, status) {
  ensureStatus(status);
  await Provider.update(id, { status });
  const row = await Provider.findById(id);
  return row ? serializeProviderRow(row) : null;
}

async function listAdmins(query) {
  const { limit, offset } = parsePagination(query);
  const rows = await executeSQL(
    `SELECT a.id, a.user_id, a.full_name, a.status, a.created_at, a.updated_date,
            u.email, u.is_email_verified
     FROM admins a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return Array.isArray(rows) ? rows : [];
}

async function updateAdminStatus(id, status) {
  ensureStatus(status);
  await Admin.update(id, { status });
  return Admin.findById(id);
}

module.exports = {
  listClients,
  getClientById,
  updateClientStatus,
  getClientDemandes,
  listProviders,
  getProviderById,
  updateProviderStatus,
  listAdmins,
  updateAdminStatus,
};
