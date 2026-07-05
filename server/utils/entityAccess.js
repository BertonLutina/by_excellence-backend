/**
 * Object-level authorization helpers (anti-IDOR).
 * Centralizes "does this user own this row?" checks used by entity controllers.
 */
const { executeSQL } = require('../db/db');

const isAdmin = (user) => user?.role === 'admin';

/** providers.id for a users.id, or null. */
async function providerIdForUser(userId) {
  if (userId == null) return null;
  const rows = await executeSQL('SELECT id FROM providers WHERE user_id = ? LIMIT 1', [userId]);
  const r = Array.isArray(rows) ? rows[0] : rows;
  return r?.id != null ? Number(r.id) : null;
}

/**
 * True if userId is the client of the service request.
 * Resilient to legacy data where client_id may be clients.id instead of users.id.
 */
async function isRequestClient(requestId, userId) {
  if (requestId == null || userId == null) return false;
  const rows = await executeSQL('SELECT client_id FROM service_requests WHERE id = ? LIMIT 1', [requestId]);
  const sr = Array.isArray(rows) ? rows[0] : rows;
  if (!sr) return false;
  if (Number(sr.client_id) === Number(userId)) return true;
  const legacy = await executeSQL('SELECT user_id FROM clients WHERE id = ? LIMIT 1', [sr.client_id]);
  const l = Array.isArray(legacy) ? legacy[0] : legacy;
  return l?.user_id != null && Number(l.user_id) === Number(userId);
}

/** True if the offer belongs to the provider owned by userId. */
async function isOfferProvider(offer, userId) {
  if (!offer || userId == null) return false;
  const pid = await providerIdForUser(userId);
  return pid != null && Number(offer.provider_id) === pid;
}

/** True if userId is the client of the request the offer answers. */
async function isOfferClient(offer, userId) {
  if (!offer || userId == null) return false;
  return isRequestClient(offer.request_id, userId);
}

/** Keep only the allowed keys of an update payload. Returns [filtered, rejectedKeys]. */
function pickFields(body, allowed) {
  const out = {};
  const rejected = [];
  for (const [k, v] of Object.entries(body || {})) {
    if (allowed.includes(k)) out[k] = v;
    else rejected.push(k);
  }
  return [out, rejected];
}

module.exports = {
  isAdmin,
  providerIdForUser,
  isRequestClient,
  isOfferProvider,
  isOfferClient,
  pickFields,
};
