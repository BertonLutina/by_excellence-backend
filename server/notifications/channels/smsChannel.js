/**
 * SMS channel — Twilio or Africa's Talking, chosen via SMS_PROVIDER.
 * Fallback channel for feature phones / users without WhatsApp.
 * Scaffold: fill the TODO(wire) blocks. Returns SKIPPED when unconfigured.
 */
const { Channel, CHANNEL_RESULT, result } = require('./Channel');
const { notificationsConfig } = require('../config');
const { isValidE164 } = require('../phone');

class SmsChannel extends Channel {
  get id() {
    return 'sms';
  }

  isConfigured() {
    const c = notificationsConfig().sms;
    if (c.provider === 'twilio') return Boolean(c.twilio.sid && c.twilio.token && c.twilio.from);
    if (c.provider === 'africastalking') return Boolean(c.africastalking.apiKey && c.africastalking.username);
    return false;
  }

  async send({ to, text }) {
    if (!this.isConfigured()) return result(CHANNEL_RESULT.SKIPPED, { reason: 'not_configured' });
    if (!isValidE164(to)) return result(CHANNEL_RESULT.SKIPPED, { reason: 'invalid_number' });

    const c = notificationsConfig().sms;
    try {
      if (c.provider === 'twilio') {
        // TODO(wire): Twilio Messages API — From c.twilio.from, To `to`, Body text.
        throw new Error('twilio.sms send: TODO(wire)');
      }
      if (c.provider === 'africastalking') {
        // TODO(wire): POST https://api.africastalking.com/version1/messaging
        //   headers: { apiKey: c.africastalking.apiKey, 'Content-Type':'application/x-www-form-urlencoded' }
        //   body: username, to, message: text, from: c.africastalking.senderId
        throw new Error('africastalking.sms send: TODO(wire)');
      }
      return result(CHANNEL_RESULT.SKIPPED, { reason: 'no_provider' });
    } catch (err) {
      return result(CHANNEL_RESULT.FAILED, { error: err.message });
    }
  }
}

module.exports = SmsChannel;
