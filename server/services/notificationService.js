const { executeSQL } = require('../db/db');
const sseBus = require('../realtime/sseBus');
const ServiceRequest = require('../models/ServiceRequest');
const Offer = require('../models/Offer');
const Provider = require('../models/Provider');
const User = require('../models/User');
const { sendMail } = require('../utils/mailer');
const { FRONTEND_ORIGIN } = require('../../constants/constant');
const { sendStatusNotification, STATUS_CONFIG } = require('./statusNotificationService');

const OFFER_STATUS_CONFIG = {
  sent_to_admin: {
    label: 'Nouvelle offre à valider',
    emoji: '📋',
    admin: true,
    provider: false,
    client: false,
  },
  sent_to_client: {
    label: 'Offre disponible',
    emoji: '📨',
    admin: false,
    provider: true,
    client: true,
  },
  accepted: {
    label: 'Offre acceptée',
    emoji: '✅',
    admin: true,
    provider: true,
    client: false,
  },
  rejected: {
    label: 'Offre refusée',
    emoji: '❌',
    admin: true,
    provider: true,
    client: false,
  },
};

function appBase() {
  return String(FRONTEND_ORIGIN || '').replace(/\/$/, '');
}

async function getAdminUserIds() {
  const rows = await executeSQL(`SELECT user_id FROM admins WHERE status = 'active'`);
  return [...new Set((Array.isArray(rows) ? rows : []).map((r) => Number(r.user_id)).filter(Boolean))];
}

async function getClientUserId(request) {
  if (!request?.client_id) return null;
  const direct = Number(request.client_id);
  const rows = await executeSQL('SELECT user_id FROM clients WHERE id = ?', [request.client_id]);
  const legacyUid = (Array.isArray(rows) ? rows[0] : rows)?.user_id;
  return legacyUid ? Number(legacyUid) : direct;
}

async function getProviderUserId(providerId) {
  if (!providerId) return null;
  const rows = await executeSQL('SELECT user_id FROM providers WHERE id = ?', [providerId]);
  const r = Array.isArray(rows) ? rows[0] : rows;
  return r?.user_id ? Number(r.user_id) : null;
}

async function insertNotification(userId, { type, title, body, payload }) {
  const uid = Number(userId);
  if (!uid) return null;
  const result = await executeSQL(
    `INSERT INTO notifications (user_id, type, title, body, payload) VALUES (?, ?, ?, ?, ?)`,
    [uid, type, title, body, JSON.stringify(payload || {})]
  );
  const insertId = result?.insertId ?? (Array.isArray(result) ? result[0]?.insertId : null);
  const row = {
    id: insertId,
    user_id: uid,
    type,
    title,
    body,
    payload: payload || {},
    is_read: false,
    created_at: new Date().toISOString(),
  };
  sseBus.publishToUser(uid, 'Notification:created', row);
  return row;
}

async function insertForUsers(userIds, data) {
  const ids = [...new Set((userIds || []).map((id) => Number(id)).filter(Boolean))];
  const rows = [];
  for (const userId of ids) {
    rows.push(await insertNotification(userId, data));
  }
  return rows;
}

function detailUrlForRole(role, requestId, offerId) {
  const base = appBase();
  if (role === 'admin') return `${base}/AdminRequestDetail?id=${requestId}`;
  if (role === 'provider') {
    return offerId
      ? `${base}/ProviderDashboard?request=${requestId}&offer=${offerId}`
      : `${base}/ProviderDashboard?request=${requestId}`;
  }
  return `${base}/ClientRequestDetail?id=${requestId}`;
}

async function notifyNewMessage(messageRow, audienceUserIds) {
  const senderId = Number(messageRow.sender_id);
  const recipientIds = (audienceUserIds || []).filter((id) => Number(id) !== senderId);
  if (!recipientIds.length) return;

  const request = await ServiceRequest.findById(messageRow.request_id);
  const preview = String(messageRow.content || '').trim().slice(0, 120);
  const title = 'Nouveau message';
  const body = preview
    ? `${preview}${messageRow.content?.length > 120 ? '…' : ''}`
    : 'Vous avez reçu un nouveau message.';

  for (const userId of recipientIds) {
    const user = await User.findById(userId);
    const role = user?.role || 'client';
    const href = detailUrlForRole(role, messageRow.request_id, messageRow.offer_id);
    await insertNotification(userId, {
      type: 'new_message',
      title,
      body,
      payload: {
        request_id: messageRow.request_id,
        offer_id: messageRow.offer_id ?? null,
        message_id: messageRow.id,
        href,
      },
    });
  }
}

async function getCollaboratorUserIds(requestId, { statuses = ['accepted', 'invited'] } = {}) {
  const st = (statuses || []).map((s) => `'${s}'`).join(',');
  const rows = await executeSQL(
    `SELECT provider_id FROM service_request_collaborators
     WHERE request_id = ? AND status IN (${st})`,
    [Number(requestId)]
  );
  const ids = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const uid = await getProviderUserId(row.provider_id);
    if (uid) ids.push(uid);
  }
  return [...new Set(ids)];
}

/**
 * Notify all providers in a combo request + admin + client.
 */
async function notifyComboRequestCreated(requestRow) {
  if (!requestRow?.id) return;
  const requestId = requestRow.id;
  const collaborators = requestRow.collaborators || [];
  const providerIds = collaborators.length
    ? collaborators.map((c) => Number(c.provider_id)).filter(Boolean)
    : [];

  const providerUserIds = [];
  for (const pid of providerIds) {
    const uid = await getProviderUserId(pid);
    if (uid) providerUserIds.push(uid);
  }

  const adminIds = await getAdminUserIds();
  const clientUserId = await getClientUserId(requestRow);
  const title = '🤝 Nouvelle demande combo';
  const body = `Demande #${String(requestId).slice(-6)} — ${requestRow.client_name || 'Client'}`;

  const targets = [
    ...providerUserIds.map((userId) => ({
      userId,
      href: detailUrlForRole('provider', requestId),
    })),
    ...adminIds.map((userId) => ({
      userId,
      href: detailUrlForRole('admin', requestId),
    })),
  ];
  if (clientUserId) {
    targets.push({ userId: clientUserId, href: detailUrlForRole('client', requestId) });
  }

  for (const t of targets) {
    await insertNotification(t.userId, {
      type: 'combo_request',
      title,
      body,
      payload: { request_id: requestId, href: t.href, is_combo: true },
    });
  }
}

async function notifyCollaborationInvite(requestId, invitedProviderId, invitedByProviderId) {
  const invitedUserId = await getProviderUserId(invitedProviderId);
  if (!invitedUserId) return;

  const leadRows = invitedByProviderId
    ? await executeSQL('SELECT display_name FROM providers WHERE id = ?', [invitedByProviderId])
    : [];
  const leadName = (Array.isArray(leadRows) ? leadRows[0] : leadRows)?.display_name;

  await insertNotification(invitedUserId, {
    type: 'collaboration_invite',
    title: '📩 Invitation à collaborer',
    body: leadName
      ? `${leadName} vous invite sur la demande #${String(requestId).slice(-6)}`
      : `Invitation sur la demande #${String(requestId).slice(-6)}`,
    payload: {
      request_id: requestId,
      provider_id: invitedProviderId,
      href: detailUrlForRole('provider', requestId),
    },
  });
}

async function notifyCollaborationResponse(requestId, providerId, status) {
  const leadRows = await executeSQL(
    `SELECT provider_id FROM service_request_collaborators
     WHERE request_id = ? AND role = 'lead' AND status != 'removed' LIMIT 1`,
    [Number(requestId)]
  );
  const leadRow = Array.isArray(leadRows) ? leadRows[0] : leadRows;
  const leadProviderId = leadRow?.provider_id;
  const leadUserId = leadProviderId ? await getProviderUserId(leadProviderId) : null;
  const adminIds = await getAdminUserIds();

  const provRows = await executeSQL('SELECT display_name FROM providers WHERE id = ?', [providerId]);
  const pname = (Array.isArray(provRows) ? provRows[0] : provRows)?.display_name || 'Prestataire';
  const accepted = status === 'accepted';
  const title = accepted ? '✅ Collaboration acceptée' : '❌ Collaboration refusée';
  const body = `${pname} a ${accepted ? 'accepté' : 'refusé'} l'invitation — demande #${String(requestId).slice(-6)}`;

  const targets = [...adminIds];
  if (leadUserId) targets.push(leadUserId);

  for (const userId of [...new Set(targets)]) {
    await insertNotification(userId, {
      type: 'collaboration_response',
      title,
      body,
      payload: {
        request_id: requestId,
        provider_id: providerId,
        status,
        href: detailUrlForRole('admin', requestId),
      },
    });
  }
}

/**
 * Email + in-app for service_requests.status changes.
 */
async function notifyRequestStatusChange(requestId, newStatus, { sendEmail = true } = {}) {
  if (!requestId || !newStatus) return;
  const cfg = STATUS_CONFIG[newStatus];
  if (!cfg) return;

  const request = await ServiceRequest.findById(requestId);
  if (!request) return;

  const clientUserId = await getClientUserId(request);
  const providerUserId = await getProviderUserId(request.provider_id);
  const collaboratorUserIds = await getCollaboratorUserIds(requestId, { statuses: ['accepted'] });
  const adminIds = await getAdminUserIds();

  const title = `${cfg.emoji} ${cfg.label}`;
  const body = `Demande #${String(requestId).slice(-6)} — ${request.service_description || 'Prestation'}`;
  const payload = { request_id: requestId, status: newStatus, href: null };

  const targets = [];
  if (cfg.client && clientUserId) {
    targets.push({
      userId: clientUserId,
      href: detailUrlForRole('client', requestId),
    });
  }
  if (cfg.provider && providerUserId) {
    targets.push({
      userId: providerUserId,
      href: detailUrlForRole('provider', requestId),
    });
  }
  for (const uid of collaboratorUserIds) {
    if (uid === providerUserId) continue;
    targets.push({
      userId: uid,
      href: detailUrlForRole('provider', requestId),
    });
  }
  if (cfg.admin) {
    for (const adminId of adminIds) {
      targets.push({
        userId: adminId,
        href: detailUrlForRole('admin', requestId),
      });
    }
  }

  const seen = new Set();
  for (const t of targets) {
    if (seen.has(t.userId)) continue;
    seen.add(t.userId);
    await insertNotification(t.userId, {
      type: 'status_update',
      title,
      body,
      payload: { ...payload, href: t.href },
    });
  }

  if (sendEmail) {
    await sendStatusNotification({ request_id: requestId, new_status: newStatus }).catch((e) => {
      console.warn('[notifyRequestStatusChange] email failed:', e.message);
    });
  }
}

/**
 * Email + in-app for offers.status changes.
 */
async function notifyOfferStatusChange(offerId, newStatus, { sendEmail = true } = {}) {
  if (!offerId || !newStatus) return;
  const cfg = OFFER_STATUS_CONFIG[newStatus];
  if (!cfg) return;

  const offer = await Offer.findById(offerId);
  if (!offer) return;
  const request = await ServiceRequest.findById(offer.request_id);
  if (!request) return;

  const clientUserId = await getClientUserId(request);
  const providerUserId = await getProviderUserId(offer.provider_id);
  const adminIds = await getAdminUserIds();

  const title = `${cfg.emoji} ${cfg.label}`;
  const body = `Offre ${offer.total_amount ?? ''}€ — ${request.client_name || 'Client'}`;
  const shortId = String(request.id).slice(-6);

  const targets = [];
  if (cfg.client && clientUserId) {
    targets.push({ userId: clientUserId, role: 'client' });
  }
  if (cfg.provider && providerUserId) {
    targets.push({ userId: providerUserId, role: 'provider' });
  }
  if (cfg.admin) {
    for (const adminId of adminIds) targets.push({ userId: adminId, role: 'admin' });
  }

  for (const t of targets) {
    const href = detailUrlForRole(t.role, request.id, offer.id);
    await insertNotification(t.userId, {
      type: 'offer_status',
      title,
      body,
      payload: {
        request_id: request.id,
        offer_id: offer.id,
        status: newStatus,
        href,
      },
    });
  }

  if (!sendEmail) return;

  const appUrl = appBase();
  const admins = await User.findAll({ role: 'admin' });

  if (cfg.client && request.client_email) {
    await sendMail({
      to: request.client_email,
      subject: `[By Excellence] ${title}`,
      html: `<p>Bonjour ${request.client_name || ''},</p><p>${title} pour votre demande #${shortId}.</p><p><a href="${detailUrlForRole('client', request.id)}">Voir ma demande</a></p>`,
    }).catch((e) => console.warn('[offer-email] client:', e.message));
  }

  if (cfg.provider && providerUserId) {
    const u = await User.findById(providerUserId);
    if (u?.email) {
      await sendMail({
        to: u.email,
        subject: `[By Excellence] ${title}`,
        html: `<p>Bonjour,</p><p>${title} — demande de ${request.client_name || 'client'}.</p><p><a href="${detailUrlForRole('provider', request.id, offer.id)}">Voir mes offres</a></p>`,
      }).catch((e) => console.warn('[offer-email] provider:', e.message));
    }
  }

  if (cfg.admin && admins.length) {
    for (const admin of admins) {
      if (!admin.email) continue;
      await sendMail({
        to: admin.email,
        subject: `[By Excellence Admin] ${title} — #${shortId}`,
        html: `<p>${title} — ${request.client_name} / ${request.provider_name}.</p><p><a href="${detailUrlForRole('admin', request.id)}">Voir la demande</a></p>`,
      }).catch((e) => console.warn('[offer-email] admin:', e.message));
    }
  }
}

async function listForUser(userId, { limit = 30, unreadOnly = false } = {}) {
  const uid = Number(userId);
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const where = unreadOnly ? 'AND is_read = 0' : '';
  const rows = await executeSQL(
    `SELECT * FROM notifications WHERE user_id = ? ${where} ORDER BY created_at DESC LIMIT ${safeLimit}`,
    [uid]
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    ...r,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload || '{}') : r.payload || {},
    is_read: Boolean(r.is_read),
  }));
}

async function countUnread(userId) {
  const rows = await executeSQL(
    'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0',
    [Number(userId)]
  );
  const r = Array.isArray(rows) ? rows[0] : rows;
  return Number(r?.n || 0);
}

async function markRead(notificationId, userId) {
  await executeSQL(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [Number(notificationId), Number(userId)]
  );
  return { ok: true };
}

async function markAllRead(userId) {
  await executeSQL('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [
    Number(userId),
  ]);
  return { ok: true };
}

module.exports = {
  insertNotification,
  insertForUsers,
  notifyNewMessage,
  notifyRequestStatusChange,
  notifyOfferStatusChange,
  notifyComboRequestCreated,
  notifyCollaborationInvite,
  notifyCollaborationResponse,
  listForUser,
  countUnread,
  markRead,
  markAllRead,
  detailUrlForRole,
};
