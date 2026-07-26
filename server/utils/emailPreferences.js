const User = require('../models/User');

const EMAIL_PREF_KEYS = [
  'status.request_sent',
  'status.in_review',
  'status.offer_preparation',
  'status.offer_sent',
  'status.offer_accepted',
  'status.deposit_paid',
  'status.date_confirmed',
  'status.final_payment_pending',
  'status.completed',
  'status.cancelled',
  'offer.sent_to_admin',
  'offer.sent_to_client',
  'offer.accepted',
  'offer.rejected',
  'payments.confirmation',
  'payments.reminder_upcoming',
  'payments.reminder_overdue',
  'payments.window_open',
  'combo.request',
  'collaboration.invite',
  'collaboration.response',
];

const DEFAULT_EMAIL_PREFS = Object.fromEntries(EMAIL_PREF_KEYS.map((k) => [k, true]));

function parseRaw(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw;
  return {};
}

function getEmailPrefs(raw) {
  const stored = parseRaw(raw);
  const out = { ...DEFAULT_EMAIL_PREFS };
  for (const k of EMAIL_PREF_KEYS) {
    if (Object.prototype.hasOwnProperty.call(stored, k) && stored[k] === false) {
      out[k] = false;
    }
  }
  return out;
}

function wantsEmail(userOrPrefs, key) {
  if (!EMAIL_PREF_KEYS.includes(key)) return true;
  if (userOrPrefs == null) return true;
  const raw =
    userOrPrefs.email_notifications !== undefined
      ? userOrPrefs.email_notifications
      : userOrPrefs;
  return getEmailPrefs(raw)[key] !== false;
}

function mergeEmailPrefs(existingRaw, partial) {
  const base = getEmailPrefs(existingRaw);
  const patch = partial && typeof partial === 'object' ? partial : {};
  for (const k of EMAIL_PREF_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, k)) {
      base[k] = Boolean(patch[k]);
    }
  }
  return base;
}

async function userWantsEmail(userId, key) {
  if (!userId) return true;
  const u = await User.findById(userId);
  return wantsEmail(u, key);
}

async function emailWantsEmail(email, key) {
  if (!email) return true;
  const u = await User.findByEmail(email);
  if (!u) return true;
  return wantsEmail(u, key);
}

module.exports = {
  EMAIL_PREF_KEYS,
  DEFAULT_EMAIL_PREFS,
  getEmailPrefs,
  wantsEmail,
  mergeEmailPrefs,
  userWantsEmail,
  emailWantsEmail,
};
