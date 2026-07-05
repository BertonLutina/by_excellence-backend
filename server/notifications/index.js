/**
 * Public entry point for the WhatsApp/SMS notification layer (Roadmap Phase 5).
 *
 * Example (best-effort, from any service after an event):
 *   const outbound = require('../notifications');
 *   await outbound.notifyUser({
 *     to: client.phone,
 *     templateName: 'booking_confirmed',
 *     params: { name: client.full_name, ref: '#123', url: detailUrl },
 *   });
 *
 * This complements the existing in-app + email notifications; it does not replace
 * them and never throws into the calling flow.
 */
const { notifyUser } = require('./dispatcher');
const { render, TEMPLATES } = require('./templates');
const { toE164, isValidE164 } = require('./phone');
const { CHANNEL_RESULT } = require('./channels/Channel');
const { notificationsConfig } = require('./config');

module.exports = {
  notifyUser,
  render,
  TEMPLATES,
  toE164,
  isValidE164,
  CHANNEL_RESULT,
  notificationsConfig,
};
