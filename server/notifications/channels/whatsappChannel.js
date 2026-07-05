/**
 * WhatsApp channel — Meta Cloud API or Twilio, chosen via WHATSAPP_PROVIDER.
 * Scaffold: fill the TODO(wire) blocks. Until keys exist, send() returns SKIPPED
 * (never throws) so the dispatcher falls through to SMS.
 */
const { Channel, CHANNEL_RESULT, result } = require('./Channel');
const { notificationsConfig } = require('../config');
const { isValidE164 } = require('../phone');

class WhatsAppChannel extends Channel {
  get id() {
    return 'whatsapp';
  }

  isConfigured() {
    const c = notificationsConfig().whatsapp;
    if (c.provider === 'meta') return Boolean(c.meta.token && c.meta.phoneId);
    if (c.provider === 'twilio') return Boolean(c.twilio.sid && c.twilio.token && c.twilio.from);
    return false;
  }

  async send({ to, text /*, templateName, params */ }) {
    if (!this.isConfigured()) return result(CHANNEL_RESULT.SKIPPED, { reason: 'not_configured' });
    if (!isValidE164(to)) return result(CHANNEL_RESULT.SKIPPED, { reason: 'invalid_number' });

    const c = notificationsConfig().whatsapp;
    try {
      if (c.provider === 'meta') {
        // TODO(wire): POST https://graph.facebook.com/v20.0/${c.meta.phoneId}/messages
        //   headers: { Authorization: `Bearer ${c.meta.token}` }
        //   body: { messaging_product:'whatsapp', to, type:'text', text:{ body: text } }
        //   (production sends should use approved TEMPLATES via type:'template')
        throw new Error('meta.whatsapp send: TODO(wire)');
      }
      if (c.provider === 'twilio') {
        // TODO(wire): Twilio Messages API with From `whatsapp:${c.twilio.from}`,
        //   To `whatsapp:${to}`, Body text. Basic-auth sid:token.
        throw new Error('twilio.whatsapp send: TODO(wire)');
      }
      return result(CHANNEL_RESULT.SKIPPED, { reason: 'no_provider' });
    } catch (err) {
      return result(CHANNEL_RESULT.FAILED, { error: err.message });
    }
  }
}

module.exports = WhatsAppChannel;
