const pool = require('../config/db');
const wsServer = require('../websocket/wsServer');

const DEMANDE_TYPES = new Set(['single', 'combo']);
const DEMANDE_STATUSES = new Set(['pending', 'sent', 'accepted', 'rejected', 'completed']);
const PROVIDER_RESPONSE_VALUES = new Set(['accepted', 'rejected']);
const MAX_COMBO_PROVIDERS = 5;

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function uniqueIds(ids = []) {
  return [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
}

function validateContent(content) {
  if (typeof content !== 'string') throw fail(400, 'content must be a string');
  const trimmed = content.trim();
  if (trimmed.length < 10) throw fail(400, 'content must be at least 10 characters');
  if (trimmed.length > 5000) throw fail(400, 'content must be at most 5000 characters');
  return trimmed;
}

function validateType(type) {
  if (!DEMANDE_TYPES.has(type)) throw fail(400, "type must be 'single' or 'combo'");
  return type;
}

function validateProviderIds(type, providerIds) {
  if (!Array.isArray(providerIds)) throw fail(400, 'provider_ids must be an array');
  const ids = uniqueIds(providerIds);
  if (ids.length !== providerIds.length) throw fail(400, 'provider_ids must contain unique valid IDs');
  if (type === 'single' && ids.length !== 1) throw fail(400, 'single demande requires exactly 1 provider');
  if (type === 'combo' && (ids.length < 1 || ids.length > MAX_COMBO_PROVIDERS)) {
    throw fail(400, 'combo demande requires between 1 and 5 providers');
  }
  return ids;
}

function resolveAggregateStatus(providerRows) {
  if (!providerRows.length) return 'pending';
  const visible = providerRows.filter((r) => Number(r.is_visible) === 1);
  const rows = visible.length ? visible : providerRows;
  const acceptedCount = rows.filter((r) => r.status === 'accepted').length;
  const rejectedCount = rows.filter((r) => r.status === 'rejected').length;
  if (rejectedCount === rows.length) return 'rejected';
  if (acceptedCount > 0 && rejectedCount === 0) return 'accepted';
  if (rows.some((r) => r.status === 'sent')) return 'sent';
  return 'pending';
}

function assertAllowedFields(body, allowed) {
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unknown.length) throw fail(400, `Unknown fields: ${unknown.join(', ')}`);
}

async function withTx(fn, db = pool) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function queryProvidersExist(conn, providerIds) {
  if (!providerIds.length) return;
  const placeholders = providerIds.map(() => '?').join(',');
  const [rows] = await conn.execute(`SELECT id FROM providers WHERE id IN (${placeholders})`, providerIds);
  if (rows.length !== providerIds.length) throw fail(400, 'One or more provider_ids are invalid');
}

async function getDemandeById(conn, demandeId) {
  const [rows] = await conn.execute('SELECT * FROM demandes WHERE id = ?', [demandeId]);
  return rows[0] || null;
}

async function getDemandeProviders(conn, demandeId) {
  const [rows] = await conn.execute(
    `SELECT dp.*, p.user_id
     FROM demande_providers dp
     JOIN providers p ON p.id = dp.provider_id
     WHERE dp.demande_id = ?`,
    [demandeId]
  );
  return rows;
}

async function saveNotifications(conn, userIds, type, title, body, payload) {
  const ids = uniqueIds(userIds);
  if (!ids.length) return;
  const sql = 'INSERT INTO notifications (user_id, type, title, body, payload) VALUES (?, ?, ?, ?, ?)';
  for (const userId of ids) {
    await conn.execute(sql, [userId, type, title, body, JSON.stringify(payload || {})]);
    wsServer.sendToUserId(userId, { event: type, title, body, payload });
  }
}

async function createDemande(input, authUser, db = pool) {
  return withTx(async (conn) => {
    assertAllowedFields(input, ['type', 'title', 'content', 'description', 'provider_ids']);
    const type = validateType(input.type);
    const content = validateContent(input.content ?? input.description);
    const providerIds = validateProviderIds(type, input.provider_ids || []);
    const title = typeof input.title === 'string' ? input.title.trim() : null;

    await queryProvidersExist(conn, providerIds);

    const [insertRes] = await conn.execute(
      `INSERT INTO demandes (client_id, type, title, content, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [authUser.id, type, title, content]
    );
    const demandeId = insertRes.insertId;

    for (const providerId of providerIds) {
      await conn.execute(
        `INSERT INTO demande_providers (demande_id, provider_id, status)
         VALUES (?, ?, 'pending')`,
        [demandeId, providerId]
      );
    }

    const providers = await getDemandeProviders(conn, demandeId);
    const demande = await getDemandeById(conn, demandeId);

    await saveNotifications(
      conn,
      providers.map((p) => p.user_id),
      'demande.created',
      'New demande assigned',
      `You have been assigned to demande #${demandeId}`,
      { demande_id: demandeId }
    );

    return { demande, providers };
  }, db);
}

async function updateClientDemande(demandeId, input, authUser, db = pool) {
  return withTx(async (conn) => {
    assertAllowedFields(input, ['content', 'description', 'title']);
    const demande = await getDemandeById(conn, demandeId);
    if (!demande) throw fail(404, 'Demande not found');
    if (String(demande.client_id) !== String(authUser.id)) throw fail(403, 'Forbidden');
    if (!['pending'].includes(demande.status)) throw fail(409, 'Demande cannot be edited in current status');

    const content = input.content || input.description ? validateContent(input.content ?? input.description) : demande.content;
    const title = typeof input.title === 'string' ? input.title.trim() : demande.title;
    await conn.execute('UPDATE demandes SET title = ?, content = ? WHERE id = ?', [title, content, demandeId]);
    return getDemandeById(conn, demandeId);
  }, db);
}

async function adminPatchDemande(demandeId, input, db = pool) {
  return withTx(async (conn) => {
    assertAllowedFields(input, ['title', 'content', 'description', 'status', 'forwarded_at']);
    const demande = await getDemandeById(conn, demandeId);
    if (!demande) throw fail(404, 'Demande not found');
    const nextStatus = input.status ?? demande.status;
    if (!DEMANDE_STATUSES.has(nextStatus)) throw fail(400, 'Invalid status');
    const content = input.content || input.description ? validateContent(input.content ?? input.description) : demande.content;
    const title = typeof input.title === 'string' ? input.title.trim() : demande.title;
    const forwardedAt = input.forwarded_at ?? demande.forwarded_at;

    await conn.execute(
      'UPDATE demandes SET title = ?, content = ?, status = ?, forwarded_at = ? WHERE id = ?',
      [title, content, nextStatus, forwardedAt, demandeId]
    );
    const updated = await getDemandeById(conn, demandeId);
    wsServer.broadcast({ event: 'demande.status_updated', payload: { demande_id: demandeId, status: updated.status } });
    return updated;
  }, db);
}

async function adminReplaceProviders(demandeId, input, db = pool) {
  return withTx(async (conn) => {
    assertAllowedFields(input, ['provider_ids']);
    const demande = await getDemandeById(conn, demandeId);
    if (!demande) throw fail(404, 'Demande not found');
    const providerIds = validateProviderIds(demande.type, input.provider_ids || []);
    await queryProvidersExist(conn, providerIds);

    await conn.execute('DELETE FROM demande_providers WHERE demande_id = ?', [demandeId]);
    for (const providerId of providerIds) {
      await conn.execute(
        `INSERT INTO demande_providers (demande_id, provider_id, status)
         VALUES (?, ?, 'pending')`,
        [demandeId, providerId]
      );
    }
    return getDemandeProviders(conn, demandeId);
  }, db);
}

async function adminAssignParts(demandeId, input, db = pool) {
  return withTx(async (conn) => {
    assertAllowedFields(input, ['assignments']);
    if (!Array.isArray(input.assignments)) throw fail(400, 'assignments must be an array');
    for (const row of input.assignments) {
      if (!row || !Number.isInteger(Number(row.provider_id))) throw fail(400, 'Invalid assignment provider_id');
      await conn.execute(
        'UPDATE demande_providers SET assigned_part = ? WHERE demande_id = ? AND provider_id = ?',
        [row.assigned_part ?? null, demandeId, Number(row.provider_id)]
      );
    }
    return getDemandeProviders(conn, demandeId);
  }, db);
}

async function adminForwardDemande(demandeId, db = pool) {
  return withTx(async (conn) => {
    const demande = await getDemandeById(conn, demandeId);
    if (!demande) throw fail(404, 'Demande not found');
    const now = new Date();
    await conn.execute('UPDATE demandes SET forwarded_at = ?, status = ? WHERE id = ?', [now, 'sent', demandeId]);
    await conn.execute(
      "UPDATE demande_providers SET status = 'sent' WHERE demande_id = ? AND is_visible = 1",
      [demandeId]
    );
    const providers = await getDemandeProviders(conn, demandeId);
    await saveNotifications(
      conn,
      providers.filter((p) => Number(p.is_visible) === 1).map((p) => p.user_id),
      'demande.forwarded',
      'Demande forwarded',
      `Demande #${demandeId} has been forwarded`,
      { demande_id: demandeId }
    );
    wsServer.broadcast({ event: 'demande.forwarded', payload: { demande_id: demandeId } });
    return getDemandeById(conn, demandeId);
  }, db);
}

function isTransitionAllowed(from, to) {
  const graph = {
    pending: new Set(['sent', 'rejected']),
    sent: new Set(['accepted', 'rejected', 'completed']),
    accepted: new Set(['completed', 'rejected']),
    rejected: new Set([]),
    completed: new Set([]),
  };
  return from === to || graph[from]?.has(to);
}

async function adminUpdateStatus(demandeId, status, db = pool) {
  return withTx(async (conn) => {
    if (!DEMANDE_STATUSES.has(status)) throw fail(400, 'Invalid status');
    const demande = await getDemandeById(conn, demandeId);
    if (!demande) throw fail(404, 'Demande not found');
    if (!isTransitionAllowed(demande.status, status)) throw fail(409, 'Invalid status transition');
    await conn.execute('UPDATE demandes SET status = ? WHERE id = ?', [status, demandeId]);
    wsServer.broadcast({ event: 'demande.status_updated', payload: { demande_id: demandeId, status } });
    return getDemandeById(conn, demandeId);
  }, db);
}

async function getProviderDemandes(authUser, db = pool) {
  const [providerRows] = await db.execute('SELECT id FROM providers WHERE user_id = ?', [authUser.id]);
  const provider = providerRows[0];
  if (!provider) return [];
  const [rows] = await db.execute(
    `SELECT d.*, dp.provider_id, dp.status AS provider_status, dp.assigned_part, dp.is_visible
     FROM demande_providers dp
     JOIN demandes d ON d.id = dp.demande_id
     WHERE dp.provider_id = ? AND dp.is_visible = 1
     ORDER BY d.created_at DESC`,
    [provider.id]
  );
  return rows;
}

async function getProviderDemandeById(demandeId, authUser, db = pool) {
  const [providerRows] = await db.execute('SELECT id FROM providers WHERE user_id = ?', [authUser.id]);
  const provider = providerRows[0];
  if (!provider) throw fail(403, 'Forbidden');
  const [rows] = await db.execute(
    `SELECT d.*, dp.provider_id, dp.status AS provider_status, dp.assigned_part, dp.is_visible
     FROM demande_providers dp
     JOIN demandes d ON d.id = dp.demande_id
     WHERE dp.demande_id = ? AND dp.provider_id = ?`,
    [demandeId, provider.id]
  );
  const row = rows[0];
  if (!row || Number(row.is_visible) !== 1) throw fail(403, 'Forbidden');
  return row;
}

async function providerRespond(demandeId, input, authUser, db = pool) {
  return withTx(async (conn) => {
    assertAllowedFields(input, ['response', 'message']);
    if (!PROVIDER_RESPONSE_VALUES.has(input.response)) throw fail(400, "response must be 'accepted' or 'rejected'");

    const [providerRows] = await conn.execute('SELECT id FROM providers WHERE user_id = ?', [authUser.id]);
    const provider = providerRows[0];
    if (!provider) throw fail(403, 'Forbidden');

    const [linkRows] = await conn.execute(
      'SELECT * FROM demande_providers WHERE demande_id = ? AND provider_id = ?',
      [demandeId, provider.id]
    );
    const link = linkRows[0];
    if (!link || Number(link.is_visible) !== 1) throw fail(403, 'Forbidden');

    await conn.execute(
      'UPDATE demande_providers SET status = ?, responded_at = NOW() WHERE demande_id = ? AND provider_id = ?',
      [input.response, demandeId, provider.id]
    );
    await conn.execute(
      `INSERT INTO demande_provider_responses (demande_id, provider_id, response, message)
       VALUES (?, ?, ?, ?)`,
      [demandeId, provider.id, input.response, input.message || null]
    );

    const providers = await getDemandeProviders(conn, demandeId);
    const nextStatus = resolveAggregateStatus(providers);
    await conn.execute('UPDATE demandes SET status = ? WHERE id = ?', [nextStatus, demandeId]);
    const demande = await getDemandeById(conn, demandeId);

    await saveNotifications(
      conn,
      [demande.client_id],
      'demande.provider_response',
      'Provider responded',
      `A provider has ${input.response} demande #${demandeId}`,
      { demande_id: demandeId, response: input.response }
    );
    wsServer.broadcast({
      event: 'demande.provider_response',
      payload: { demande_id: demandeId, provider_id: provider.id, response: input.response, status: nextStatus },
    });
    return { demande, provider_id: provider.id, response: input.response };
  }, db);
}

module.exports = {
  createDemande,
  updateClientDemande,
  adminPatchDemande,
  adminReplaceProviders,
  adminAssignParts,
  adminForwardDemande,
  adminUpdateStatus,
  getProviderDemandes,
  getProviderDemandeById,
  providerRespond,
  __private: {
    validateContent,
    validateType,
    validateProviderIds,
    resolveAggregateStatus,
    isTransitionAllowed,
    fail,
  },
};
