/**
 * Channel — the common contract for an outbound messaging channel
 * (WhatsApp, SMS, and conceptually email). The dispatcher talks to this, never
 * to a specific gateway.
 *
 * Unlike payments, notifications are BEST-EFFORT: a channel reports success or
 * failure via a result object and does not throw for "not configured" — the
 * dispatcher simply moves to the next channel.
 */

const CHANNEL_RESULT = Object.freeze({
  SENT: 'sent',
  SKIPPED: 'skipped',       // channel not configured / no destination
  FAILED: 'failed',         // gateway error
});

function result(status, extra = {}) {
  return { status, ...extra };
}

class Channel {
  /** @returns {string} 'whatsapp' | 'sms' */
  get id() {
    throw new Error('Channel.id not implemented');
  }

  /** @returns {boolean} credentials present */
  isConfigured() {
    return false;
  }

  /**
   * @param {{ to: string, text: string, templateName?: string, params?: object }} _msg
   * @returns {Promise<{status: string}>}
   */
  async send(_msg) {
    return result(CHANNEL_RESULT.SKIPPED, { reason: 'not_implemented' });
  }
}

module.exports = { Channel, CHANNEL_RESULT, result };
