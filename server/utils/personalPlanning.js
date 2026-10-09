const ALLOWED_ROLES = new Set(['admin', 'provider']);
const TITLE_MAX = 200;
const NOTES_MAX = 2000;

function canUsePersonalPlanning(role) {
  return ALLOWED_ROLES.has(String(role || ''));
}

function normalizeTitle(value) {
  const title = String(value || '').trim();
  if (!title) return null;
  return title.slice(0, TITLE_MAX);
}

function normalizeNotes(value) {
  if (value == null || value === '') return null;
  const notes = String(value).trim();
  if (!notes) return null;
  return notes.slice(0, NOTES_MAX);
}

function normalizeDate(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  return raw;
}

function normalizeTime(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return undefined;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  const ss = Number(match[3] || 0);
  if (hh > 23 || mm > 59 || ss > 59) return undefined;
  return `${match[1]}:${match[2]}:${match[3] || '00'}`;
}

function coerceDone(value, fallback = false) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

/**
 * Build a sanitized create/update payload. Returns { error } or { data }.
 */
function sanitizePlanningPayload(body, { partial = false } = {}) {
  const src = body && typeof body === 'object' ? body : {};
  const data = {};

  if (!partial || Object.prototype.hasOwnProperty.call(src, 'title')) {
    const title = normalizeTitle(src.title);
    if (!title) return { error: 'title is required' };
    data.title = title;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(src, 'notes')) {
    data.notes = normalizeNotes(src.notes);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(src, 'plan_date')) {
    const planDate = normalizeDate(src.plan_date);
    if (planDate === undefined) return { error: 'plan_date must be YYYY-MM-DD' };
    data.plan_date = planDate;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(src, 'start_time')) {
    const start = normalizeTime(src.start_time);
    if (start === undefined) return { error: 'start_time must be HH:MM' };
    data.start_time = start;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(src, 'end_time')) {
    const end = normalizeTime(src.end_time);
    if (end === undefined) return { error: 'end_time must be HH:MM' };
    data.end_time = end;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(src, 'is_done')) {
    data.is_done = coerceDone(src.is_done, false);
  }

  return { data };
}

module.exports = {
  ALLOWED_ROLES,
  TITLE_MAX,
  NOTES_MAX,
  canUsePersonalPlanning,
  normalizeTitle,
  normalizeNotes,
  normalizeDate,
  normalizeTime,
  coerceDone,
  sanitizePlanningPayload,
};
