const createEntityController = require('./createEntityController');
const Message = require('../models/Message');
const ServiceRequest = require('../models/ServiceRequest');
const Offer = require('../models/Offer');
const { executeSQL } = require('../db/db');
const sseBus = require('../realtime/sseBus');
const { sendMail } = require('../utils/mailer');
const User = require('../models/User');
const { notifyNewMessage, detailUrlForRole } = require('../services/notificationService');

const base = createEntityController(Message, 'Message');

// Resolves the user.id of the provider behind a service_request.
async function getProviderUserId(requestId) {
  const req = await ServiceRequest.findById(requestId);
  if (!req?.provider_id) return null;
  const rows = await executeSQL('SELECT user_id FROM providers WHERE id = ?', [req.provider_id]);
  const r = Array.isArray(rows) ? rows[0] : rows;
  return r?.user_id ? Number(r.user_id) : null;
}

// Returns true if the given user (users.id) is the client of the request.
// Resilient to legacy data where service_requests.client_id may equal either
// clients.user_id (schema-correct) or clients.id (legacy).
async function isRequestClient(sr, userId) {
  if (!sr || userId == null) return false;
  if (Number(sr.client_id) === Number(userId)) return true;
  // Legacy: sr.client_id may reference clients.id; resolve to user_id.
  const rows = await executeSQL('SELECT user_id FROM clients WHERE id = ?', [sr.client_id]);
  const r = Array.isArray(rows) ? rows[0] : rows;
  return r?.user_id != null && Number(r.user_id) === Number(userId);
}

// Resolves audience for a chat message based on its scope.
//   - request-level (offer_id IS NULL) → client + active admins
//   - offer-level (offer_id NOT NULL)  → provider + active admins
async function getAudienceUserIds(row) {
  const ids = [];
  const adminRows = await executeSQL(
    `SELECT user_id FROM admins WHERE status = 'active'`
  );
  for (const a of Array.isArray(adminRows) ? adminRows : []) {
    if (a?.user_id) ids.push(Number(a.user_id));
  }

  const req = await ServiceRequest.findById(row.request_id);
  if (!req) return [...new Set(ids)];

  if (row.offer_id != null) {
    const providerUserId = await getProviderUserId(row.request_id);
    if (providerUserId) ids.push(providerUserId);
  } else if (req.client_id != null) {
    // sr.client_id is normally clients.user_id (== users.id), but legacy data
    // may store clients.id. Resolve to a real user_id either way.
    const direct = Number(req.client_id);
    const rows = await executeSQL('SELECT user_id FROM clients WHERE id = ?', [req.client_id]);
    const legacyUid = (Array.isArray(rows) ? rows[0] : rows)?.user_id;
    if (legacyUid) ids.push(Number(legacyUid));
    else ids.push(direct);
  }

  return [...new Set(ids)];
}

module.exports = {
  ...base,

  // Read a single message with the same visibility rules as getAll
  // (anti-IDOR): the generic CRUD getOne let any authenticated account read
  // any message by id, outside of its own conversation.
  //   admin    -> anything
  //   client   -> request-level messages (offer_id IS NULL) of their own request
  //   provider -> offer-level messages of offers tied to them
  getOne: async (req, res) => {
    try {
      const row = await Message.findById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });

      const role = req.user?.role;
      const userId = req.user?.id ? Number(req.user.id) : null;
      if (role !== 'admin') {
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        // The sender may always re-read their own message.
        if (row.sender_id == null || Number(row.sender_id) !== userId) {
          if (row.offer_id != null) {
            // Offer-scoped chat: admin/provider only, and the provider must own the offer.
            if (role !== 'provider') return res.status(403).json({ error: 'Forbidden' });
            const offer = await Offer.findById(row.offer_id);
            if (!offer) return res.status(403).json({ error: 'Forbidden' });
            const providerRows = await executeSQL(
              'SELECT user_id FROM providers WHERE id = ?',
              [offer.provider_id]
            );
            const ownerUid = (Array.isArray(providerRows) ? providerRows[0] : providerRows)?.user_id;
            if (!ownerUid || Number(ownerUid) !== userId) {
              return res.status(403).json({ error: 'Forbidden' });
            }
          } else {
            // Request-scoped chat: client (owner) <-> admin only.
            if (role === 'provider') return res.status(403).json({ error: 'Forbidden' });
            const sr = await ServiceRequest.findById(row.request_id);
            if (!(await isRequestClient(sr, userId))) {
              return res.status(403).json({ error: 'Forbidden' });
            }
          }
        }
      }

      res.json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // List messages with hard role-based visibility:
  //   admin    → can see anything they query (request_id or offer_id)
  //   client   → only request-level messages of their own request (offer_id IS NULL)
  //   provider → only offer-level messages of offers tied to them
  getAll: async (req, res) => {
    try {
      const role = req.user?.role;
      const userId = req.user?.id ? Number(req.user.id) : null;
      const { sort, limit, offset, include_total, request_id, offer_id, ...rest } = req.query;
      void include_total;
      void rest;

      const conditions = [];
      const values = [];

      if (offer_id != null && offer_id !== '') {
        // Offer-scoped chat: admin/provider only.
        if (role === 'client') return res.json([]);
        if (role === 'provider') {
          // Verify ownership: the offer must belong to this provider.
          const offer = await Offer.findById(offer_id);
          if (!offer) return res.json([]);
          const providerRows = await executeSQL(
            'SELECT user_id FROM providers WHERE id = ?',
            [offer.provider_id]
          );
          const ownerUid = (Array.isArray(providerRows) ? providerRows[0] : providerRows)?.user_id;
          if (!ownerUid || Number(ownerUid) !== userId) return res.json([]);
        }
        conditions.push('`offer_id` = ?');
        values.push(offer_id);
      } else if (request_id != null && request_id !== '') {
        // Request-scoped chat: client <-> admin only. Provider must not see it.
        if (role === 'provider') return res.json([]);
        if (role === 'client') {
          const sr = await ServiceRequest.findById(request_id);
          if (!(await isRequestClient(sr, userId))) return res.json([]);
        }
        conditions.push('`request_id` = ?');
        values.push(request_id);
        conditions.push('`offer_id` IS NULL');
      } else {
        return res.json([]);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const safeLimit = Number(limit) || 200;
      const safeOffset = Number(offset) || 0;
      // sort param kept for API parity, but we always sort by created_at ASC for chats.
      void sort;
      const sql = `SELECT * FROM \`messages\` ${where} ORDER BY \`created_at\` ASC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
      const rows = await executeSQL(sql, values);
      res.json(Array.isArray(rows) ? rows : []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const role = req.user?.role;
      const userId = req.user?.id ? Number(req.user.id) : null;
      const data = { ...req.body };
      // sender_id is always the caller (spoof-proof), except for admins.
      if (role !== 'admin' && userId) data.sender_id = userId;
      else if (userId && data.sender_id == null) data.sender_id = userId;

      // Server-side authorization: ensure the user is allowed to post on the
      // chat they're targeting. Prevents a malicious provider from posting in
      // the client/admin thread by setting offer_id to null, etc.
      if (data.request_id == null) {
        return res.status(400).json({ error: 'request_id is required' });
      }
      const sr = await ServiceRequest.findById(data.request_id);
      if (!sr) return res.status(404).json({ error: 'Request not found' });

      if (data.offer_id != null) {
        // offer-level: provider or admin only, and provider must own the offer.
        if (role === 'client') return res.status(403).json({ error: 'Forbidden' });
        if (role === 'provider') {
          const offer = await Offer.findById(data.offer_id);
          if (!offer || Number(offer.request_id) !== Number(data.request_id)) {
            return res.status(403).json({ error: 'Forbidden' });
          }
          const providerRows = await executeSQL(
            'SELECT user_id FROM providers WHERE id = ?',
            [offer.provider_id]
          );
          const ownerUid = (Array.isArray(providerRows) ? providerRows[0] : providerRows)?.user_id;
          if (!ownerUid || Number(ownerUid) !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
          }
        }
      } else {
        // request-level: client (owner) or admin only.
        if (role === 'provider') return res.status(403).json({ error: 'Forbidden' });
        if (role === 'client' && !(await isRequestClient(sr, userId))) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }

      const row = await Message.create(data);
      res.status(201).json(row);

      if (row?.request_id) {
        const userIds = await getAudienceUserIds(row);
        sseBus.publishToUsers(userIds, 'Message:created', row);

        notifyNewMessage(row, userIds).catch((e) => {
          console.warn('[message-notification] in-app failed:', e.message);
        });

        // Email notification to the audience (excluding the sender). Non-blocking.
        (async () => {
          try {
            const senderId = Number(row.sender_id);
            const recipientIds = userIds.filter((id) => id !== senderId);
            if (!recipientIds.length) return;

            const request = await ServiceRequest.findById(row.request_id);
            const preview = String(row.content || '').slice(0, 120);

            for (const uid of recipientIds) {
              const user = await User.findById(uid);
              if (!user?.email) continue;
              const detailUrl = detailUrlForRole(user.role || 'client', row.request_id, row.offer_id);
              await sendMail({
                to: user.email,
                subject: '💬 Nouveau message reçu',
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #0a0a5c;">Vous avez un nouveau message</h2>
                    <p>Bonjour ${user.full_name || ''},</p>
                    <p>Vous avez reçu un nouveau message concernant votre demande <strong>${request?.service_description || ''}</strong>.</p>
                    ${preview ? `<blockquote style="border-left: 3px solid #ffe342; padding-left: 12px; color: #555;">${preview}${row.content?.length > 120 ? '…' : ''}</blockquote>` : ''}
                    <p style="margin-top: 24px;">
                      <a href="${detailUrl}" style="background: #ffe342; color: #0a0a5c; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                        Voir le message
                      </a>
                    </p>
                    <p style="color: #666; font-size: 13px; margin-top: 24px;">L'équipe By Excellence African Services</p>
                  </div>
                `,
              });
            }
          } catch (e) {
            console.warn('[message-email] notification failed:', e.message);
          }
        })();
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // Only the sender (or an admin) may edit or delete a message (anti-IDOR).
  update: async (req, res) => {
    try {
      const before = await Message.findById(req.params.id);
      if (!before) return res.status(404).json({ error: 'Not found' });
      const userId = req.user?.id ? Number(req.user.id) : null;
      if (req.user?.role !== 'admin' && Number(before.sender_id) !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return base.update(req, res);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const before = await Message.findById(req.params.id);
      if (!before) return res.status(404).json({ error: 'Not found' });
      const userId = req.user?.id ? Number(req.user.id) : null;
      if (req.user?.role !== 'admin' && Number(before.sender_id) !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return base.remove(req, res);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
