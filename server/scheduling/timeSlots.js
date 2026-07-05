/**
 * Time-slot math for booking (Roadmap Phase 6).
 *
 * Pure functions over "HH:MM" times within a single day. Used to (a) verify a
 * requested slot falls inside a provider's availability and doesn't collide with
 * an existing booking (no double-booking), and (b) list open slots for the UI.
 *
 * Times are half-open intervals [start, end): a 09:00–10:00 booking does NOT
 * conflict with a 10:00–11:00 one.
 */

/** "HH:MM" -> minutes since midnight, or null if malformed. */
function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** minutes -> "HH:MM". */
function fromMinutes(mins) {
  const m = ((Number(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Do half-open intervals [aS,aE) and [bS,bE) overlap? (numeric minutes) */
function overlaps(aS, aE, bS, bE) {
  return aS < bE && bS < aE;
}

function toInterval(x) {
  const s = toMinutes(x.start);
  const e = toMinutes(x.end);
  if (s == null || e == null || e <= s) return null;
  return { s, e };
}

/** Is [slot.start, slot.end) fully inside at least one availability window? */
function isWithinWindows(slot, windows = []) {
  const iv = toInterval(slot);
  if (!iv) return false;
  return (windows || []).some((w) => {
    const wi = toInterval(w);
    return wi && iv.s >= wi.s && iv.e <= wi.e;
  });
}

/** Does the slot collide with any existing booking? */
function hasConflict(slot, busy = []) {
  const iv = toInterval(slot);
  if (!iv) return true; // malformed slot is never safe to book
  return (busy || []).some((b) => {
    const bi = toInterval(b);
    return bi && overlaps(iv.s, iv.e, bi.s, bi.e);
  });
}

/** Bookable = valid, inside an availability window, and free of conflicts. */
function isBookable(slot, windows = [], busy = []) {
  return isWithinWindows(slot, windows) && !hasConflict(slot, busy);
}

/**
 * List free slots of `durationMin`, stepping every `stepMin`, within the windows
 * and avoiding busy intervals. Returns [{ start, end }] as "HH:MM".
 */
function computeFreeSlots(windows = [], busy = [], durationMin = 60, stepMin = 30) {
  const dur = Number(durationMin) || 60;
  const step = Number(stepMin) || dur;
  const out = [];
  for (const w of windows || []) {
    const wi = toInterval(w);
    if (!wi) continue;
    for (let s = wi.s; s + dur <= wi.e; s += step) {
      const slot = { start: fromMinutes(s), end: fromMinutes(s + dur) };
      if (!hasConflict(slot, busy)) out.push(slot);
    }
  }
  return out;
}

module.exports = {
  toMinutes,
  fromMinutes,
  overlaps,
  isWithinWindows,
  hasConflict,
  isBookable,
  computeFreeSlots,
};
