/**
 * Notification channel configuration (env-driven, self-contained).
 *
 * WhatsApp (choose one):
 *   WHATSAPP_PROVIDER = meta | twilio
 *   META_WABA_TOKEN / META_WABA_PHONE_ID           (Meta Cloud API)
 *   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM
 * SMS (choose one):
 *   SMS_PROVIDER = twilio | africastalking
 *   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_SMS_FROM
 *   AT_API_KEY / AT_USERNAME / AT_SENDER_ID        (Africa's Talking)
 * General:
 *   NOTIFY_DEFAULT_DIAL_CODE = 225                  (for local-format numbers)
 *   NOTIFY_PREFERRED_CHANNELS = whatsapp,sms        (order; falls back down the list)
 */

function env(name, fallback = '') {
  const v = process.env[name];
  return v == null ? fallback : String(v).trim();
}

function notificationsConfig() {
  return {
    defaultDialCode: env('NOTIFY_DEFAULT_DIAL_CODE'),
    preferredChannels: env('NOTIFY_PREFERRED_CHANNELS', 'whatsapp,sms')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),

    whatsapp: {
      provider: env('WHATSAPP_PROVIDER').toLowerCase(),
      meta: { token: env('META_WABA_TOKEN'), phoneId: env('META_WABA_PHONE_ID') },
      twilio: {
        sid: env('TWILIO_ACCOUNT_SID'),
        token: env('TWILIO_AUTH_TOKEN'),
        from: env('TWILIO_WHATSAPP_FROM'),
      },
    },
    sms: {
      provider: env('SMS_PROVIDER').toLowerCase(),
      twilio: {
        sid: env('TWILIO_ACCOUNT_SID'),
        token: env('TWILIO_AUTH_TOKEN'),
        from: env('TWILIO_SMS_FROM'),
      },
      africastalking: {
        apiKey: env('AT_API_KEY'),
        username: env('AT_USERNAME'),
        senderId: env('AT_SENDER_ID'),
      },
    },
  };
}

module.exports = { notificationsConfig };
