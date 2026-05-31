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
  const sql = `
    SELECT id, client_id, status, service_description AS description, created_date, updated_date
    FROM service_requests
    WHERE client_id = ?
    ORDER BY created_date DESC
  `;
  const rows = await executeSQL(sql, [clientId]);
  return Array.isArray(rows) ? rows : [];
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
