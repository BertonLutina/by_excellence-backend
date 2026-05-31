const createEntityController = require('./createEntityController');
const Message = require('../models/Message');
const ServiceRequest = require('../models/ServiceRequest');
const { executeSQL } = require('../db/db');
const sseBus = require('../realtime/sseBus');
const { sendMail } = require('../utils/mailer');
const User = require('../models/User');
const { FRONTEND_ORIGIN } = require('../../constants/constant');

const base = createEntityController(Message, 'Message');

async function getParticipantUserIds(requestId) {
  const req = await ServiceRequest.findById(requestId);
  if (!req) return [];
  const ids = [];
  if (req.client_id) ids.push(Number(req.client_id));
  if (req.provider_id) {
    const rows = await executeSQL('SELECT user_id FROM providers WHERE id = ?', [req.provider_id]);
    const r = Array.isArray(rows) ? rows[0] : rows;
    if (r?.user_id) ids.push(Number(r.user_id));
  }
  return [...new Set(ids)];
}

module.exports = {
  ...base,
  create: async (req, res) => {
    try {
      const data = { ...req.body };
      if (req.user?.id && data.sender_id == null) data.sender_id = req.user.id;
      const row = await Message.create(data);
      res.status(201).json(row);
      if (row?.request_id) {
        const userIds = await getParticipantUserIds(row.request_id);
        sseBus.publishToUsers(userIds, 'Message:created', row);

        // Email notification to the recipient(s) — non-blocking
        (async () => {
          try {
            const senderId = Number(row.sender_id);
            const recipientIds = userIds.filter((id) => id !== senderId);
            if (!recipientIds.length) return;

            const request = await ServiceRequest.findById(row.request_id);
            const detailUrl = `${(FRONTEND_ORIGIN || '').replace(/\/$/, '')}/ClientRequestDetail?id=${row.request_id}`;
            const preview = String(row.content || '').slice(0, 120);

            for (const uid of recipientIds) {
              const user = await User.findById(uid);
              if (!user?.email) continue;
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
};
