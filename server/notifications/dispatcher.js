/**
 * Dispatcher — sends a templated message to a user over the best available
 * channel, with fallback (e.g. WhatsApp → SMS).
 *
 * BEST-EFFORT by design: it never throws into the caller. Core flows (booking,
 * payment, status change) must not fail because a notification gateway is down or
 * unconfigured. The in-app + email notifications remain the source of truth; this
 * is an additional reach-the-user layer.
 */
const WhatsAppChannel = require('./channels/whatsappChannel');
const SmsChannel = require('./channels/smsChannel');
const { CHANNEL_RESULT } = require('./channels/Channel');
const { notificationsConfig } = require('./config');
const { toE164 } = require('./phone');
const { render } = require('./templates');

const REGISTRY = {
  whatsapp: new WhatsAppChannel(),
  sms: new SmsChannel(),
};

function orderedChannels(preferred, registry = REGISTRY) {
  const order = preferred && preferred.length ? preferred : Object.keys(registry);
  return order.map((id) => registry[id]).filter(Boolean);
}

/**
 * @param {Object} opts
 * @param {string} opts.to               raw phone (any local/international format)
 * @param {string} opts.templateName
 * @param {Object} [opts.params]
 * @param {string[]} [opts.preferredChannels]  override config order
 * @param {string} [opts.defaultDialCode]      override config default
 * @param {Object} [opts.channels]             injectable registry (tests)
 * @returns {Promise<{delivered:boolean, channel?:string, reason?:string, attempts:Array}>}
 */
async function notifyUser(opts = {}) {
  const cfg = notificationsConfig();
  const {
    to,
    templateName,
    params = {},
    preferredChannels = cfg.preferredChannels,
    defaultDialCode = cfg.defaultDialCode,
    channels = REGISTRY,
  } = opts;

  const attempts = [];

  const e164 = toE164(to, defaultDialCode);
  if (!e164) return { delivered: false, reason: 'no_valid_phone', attempts };

  let text;
  try {
    text = render(templateName, params);
  } catch (err) {
    return { delivered: false, reason: `bad_template:${err.message}`, attempts };
  }

  for (const channel of orderedChannels(preferredChannels, channels)) {
    let res;
    try {
      res = await channel.send({ to: e164, text, templateName, params });
    } catch (err) {
      res = { status: CHANNEL_RESULT.FAILED, error: err.message };
    }
    attempts.push({ channel: channel.id, status: res.status, reason: res.reason || res.error });
    if (res.status === CHANNEL_RESULT.SENT) {
      return { delivered: true, channel: channel.id, attempts };
    }
  }

  return { delivered: false, reason: 'all_channels_exhausted', attempts };
}

module.exports = { notifyUser, orderedChannels, REGISTRY };
