const { executeSQL } = require('../db/db');
const { normalizeProviderId } = require('../utils/serviceRequestCombo');

async function listCollaboratorsForRequest(requestId) {
  const rid = Number(requestId);
  if (!Number.isFinite(rid) || rid <= 0) return [];
  const rows = await executeSQL(
    `SELECT c.*, p.display_name, p.profession
     FROM service_request_collaborators c
     INNER JOIN providers p ON p.id = c.provider_id
     WHERE c.request_id = ?
       AND c.status != 'removed'
     ORDER BY FIELD(c.role, 'lead', 'partner'), c.id`,
    [rid]
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: r.id,
    request_id: Number(r.request_id),
    provider_id: Number(r.provider_id),
    display_name: r.display_name,
    profession: r.profession,
    role: r.role,
    status: r.status,
    note: r.note,
    invited_by_provider_id: r.invited_by_provider_id != null ? Number(r.invited_by_provider_id) : null,
    invited_at: r.invited_at,
    responded_at: r.responded_at,
  }));
}

async function getCollaborator(requestId, providerId) {
  const rid = Number(requestId);
  const pid = Number(providerId);
  const rows = await executeSQL(
    `SELECT * FROM service_request_collaborators
     WHERE request_id = ? AND provider_id = ? AND status != 'removed'
     LIMIT 1`,
    [rid, pid]
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row || null;
}

async function getLeadProviderId(requestId) {
  const rows = await executeSQL(
    `SELECT provider_id FROM service_request_collaborators
     WHERE request_id = ? AND role = 'lead' AND status != 'removed'
     LIMIT 1`,
    [Number(requestId)]
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row?.provider_id != null ? Number(row.provider_id) : null;
}

/**
 * Sync collaborators from combo_payload after request creation.
 * @param {number} requestId
 * @param {object} comboPayload
 * @param {{ fromClient?: boolean }} opts
 */
async function syncCollaboratorsFromCombo(requestId, comboPayload, { fromClient = true } = {}) {
  if (!comboPayload?.lines?.length) return [];
  const rid = Number(requestId);
  const primaryId = normalizeProviderId(comboPayload.primary_provider_id);
  const status = fromClient ? 'accepted' : 'invited';

  const inserted = [];
  for (const line of comboPayload.lines) {
    const pid = normalizeProviderId(line.provider_id);
    if (!pid) continue;
    const role = primaryId && pid === primaryId ? 'lead' : line.role === 'lead' ? 'lead' : 'partner';
    const note = line.note != null ? String(line.note) : null;

    await executeSQL(
      `INSERT INTO service_request_collaborators
        (request_id, provider_id, role, status, note, invited_at, responded_at)
       VALUES (?, ?, ?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE
         role = VALUES(role),
         status = IF(status = 'removed', VALUES(status), status),
         note = COALESCE(VALUES(note), note),
         responded_at = IF(VALUES(status) = 'accepted', COALESCE(responded_at, NOW()), responded_at)`,
      [rid, pid, role, status, note, status === 'accepted' ? new Date() : null]
    );
    inserted.push(pid);
  }
  return inserted;
}

async function inviteCollaborator(requestId, { providerId, note, invitedByProviderId }) {
  const rid = Number(requestId);
  const pid = normalizeProviderId(providerId);
  if (!pid) throw new Error('provider_id is required');

  const existing = await getCollaborator(rid, pid);
  if (existing && existing.status !== 'removed') {
    throw new Error('Provider is already a collaborator on this request');
  }

  const leadId = await getLeadProviderId(rid);
  const role = leadId && pid === leadId ? 'lead' : 'partner';

  await executeSQL(
    `INSERT INTO service_request_collaborators
      (request_id, provider_id, role, status, note, invited_by_provider_id, invited_at)
     VALUES (?, ?, ?, 'invited', ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       status = 'invited',
       note = VALUES(note),
       invited_by_provider_id = VALUES(invited_by_provider_id),
       invited_at = NOW(),
       responded_at = NULL`,
    [rid, pid, role, note || null, invitedByProviderId || null]
  );

  return getCollaborator(rid, pid);
}

async function respondCollaborator(requestId, providerId, status) {
  const allowed = new Set(['accepted', 'declined']);
  if (!allowed.has(status)) throw new Error('status must be accepted or declined');

  const row = await getCollaborator(requestId, providerId);
  if (!row) throw new Error('Collaborator not found');
  if (row.status !== 'invited') throw new Error('Invitation is no longer pending');

  await executeSQL(
    `UPDATE service_request_collaborators
     SET status = ?, responded_at = NOW()
     WHERE request_id = ? AND provider_id = ?`,
    [status, Number(requestId), Number(providerId)]
  );

  return getCollaborator(requestId, providerId);
}

async function removeCollaborator(requestId, providerId) {
  const row = await getCollaborator(requestId, providerId);
  if (!row) throw new Error('Collaborator not found');
  if (row.role === 'lead') throw new Error('Cannot remove the lead provider');

  await executeSQL(
    `UPDATE service_request_collaborators
     SET status = 'removed', responded_at = NOW()
     WHERE request_id = ? AND provider_id = ?`,
    [Number(requestId), Number(providerId)]
  );
}

async function providerCanCreateOffer(requestId, providerId) {
  const rid = Number(requestId);
  const pid = Number(providerId);
  const requestRows = await executeSQL('SELECT provider_id, is_combo, partnership_id FROM service_requests WHERE id = ?', [rid]);
  const request = Array.isArray(requestRows) ? requestRows[0] : requestRows;
  if (!request) return false;

  if (request.partnership_id) {
    return Number(request.provider_id) === pid;
  }

  if (Number(request.provider_id) === pid) return true;

  const collab = await getCollaborator(rid, pid);
  return collab?.status === 'accepted';
}

async function listRequestIdsForProvider(providerId) {
  const pid = Number(providerId);
  const rows = await executeSQL(
    `SELECT DISTINCT sr.id
     FROM service_requests sr
     LEFT JOIN service_request_collaborators c
       ON c.request_id = sr.id AND c.provider_id = ? AND c.status IN ('invited', 'accepted')
     WHERE sr.provider_id = ? OR c.provider_id = ?`,
    [pid, pid, pid]
  );
  return (Array.isArray(rows) ? rows : []).map((r) => Number(r.id));
}

module.exports = {
  listCollaboratorsForRequest,
  getCollaborator,
  getLeadProviderId,
  syncCollaboratorsFromCombo,
  inviteCollaborator,
  respondCollaborator,
  removeCollaborator,
  providerCanCreateOffer,
  listRequestIdsForProvider,
};
