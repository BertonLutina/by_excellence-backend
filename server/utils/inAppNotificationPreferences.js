const User = require('../models/User');

const IN_APP_PREF_KEYS = [
  'new_message',
  'status_update',
  'offer_status',
  'combo_request',
  'collaboration_invite',
  'collaboration_response',
  'partnership_invite',
  'partnership_response',
  'payment_received',
  'review_published',
  'new_offer',
];

const DEFAULT_IN_APP_PREFS = Object.fromEntries(IN_APP_PREF_KEYS.map((k) => [k, true]));

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

function getInAppPrefs(raw) {
  const stored = parseRaw(raw);
  const out = { ...DEFAULT_IN_APP_PREFS };
  for (const k of IN_APP_PREF_KEYS) {
    if (Object.prototype.hasOwnProperty.call(stored, k) && stored[k] === false) {
      out[k] = false;
    }
  }
  return out;
}

function wantsInApp(userOrPrefs, type) {
  if (!type || !IN_APP_PREF_KEYS.includes(type)) return true;
  if (userOrPrefs == null) return true;
  const raw =
    userOrPrefs.in_app_notifications !== undefined
      ? userOrPrefs.in_app_notifications
      : userOrPrefs;
  return getInAppPrefs(raw)[type] !== false;
}

function mergeInAppPrefs(existingRaw, partial) {
  const base = getInAppPrefs(existingRaw);
  const patch = partial && typeof partial === 'object' ? partial : {};
  for (const k of IN_APP_PREF_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, k)) {
      base[k] = Boolean(patch[k]);
    }
  }
  return base;
}

async function userWantsInApp(userId, type) {
  if (!userId) return true;
  const u = await User.findById(userId);
  return wantsInApp(u, type);
}

module.exports = {
  IN_APP_PREF_KEYS,
  DEFAULT_IN_APP_PREFS,
  getInAppPrefs,
  wantsInApp,
  mergeInAppPrefs,
  userWantsInApp,
};
