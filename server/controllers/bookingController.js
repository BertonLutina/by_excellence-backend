/**
 * Booking endpoints (Roadmap Phase 6 wiring).
 *
 * Create validates the requested slot against the provider's availability and
 * existing bookings (no double-booking) via scheduling/timeSlots. Lifecycle
 * transitions go through scheduling/bookingStatus (guarded). Cancellation consults
 * scheduling/cancellationPolicy and returns the escrow outcome to apply.
 *
 * Requires the bookings table — run: node server/scripts/add-bookings-table.js
 */
const Booking = require('../models/Booking');
const { executeSQL } = require('../db/db');
const slots = require('../scheduling/timeSlots');
const bookingStatus = require('../scheduling/bookingStatus');
const { assessCancellation } = require('../scheduling/cancellationPolicy');
const { isAdmin, providerIdForUser } = require('../utils/entityAccess');

const hhmm = (t) => String(t || '').slice(0, 5);

async function loadWindows(providerId, slotDate) {
  const dow = new Date(slotDate).getDay(); // 0..6 (Sun..Sat)
  const rows = await executeSQL(
    `SELECT start_time, end_time FROM provider_availability
     WHERE provider_id = ? AND is_available = 1
       AND (slot_date = ? OR (slot_date IS NULL AND day_of_week = ?))`,
    [providerId, slotDate, dow]
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({ start: hhmm(r.start_time), end: hhmm(r.end_time) }));
}

async function loadBusy(providerId, slotDate, excludeId = null) {
  const base = `SELECT start_time, end_time FROM bookings
     WHERE provider_id = ? AND slot_date = ? AND status IN ('requested','confirmed')`;
  const rows = await executeSQL(
    excludeId ? `${base} AND id != ?` : base,
    excludeId ? [providerId, slotDate, excludeId] : [providerId, slotDate]
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({ start: hhmm(r.start_time), end: hhmm(r.end_time) }));
}

async function isProviderOf(booking, user) {
  if (isAdmin(user)) return true;
  const pid = await providerIdForUser(user?.id);
  return pid != null && Number(booking.provider_id) === pid;
}

async function isPartyOf(booking, user) {
  if (isAdmin(user)) return true;
  if (user?.id != null && Number(booking.client_id) === Number(user.id)) return true;
  return isProviderOf(booking, user);
}

async function applyTransition(res, booking, event, patch = {}) {
  const next = bookingStatus.apply(booking.status, event); // throws 409 on invalid
  await Booking.update(booking.id, { status: next, ...patch });
  return next;
}

module.exports = {
  // List bookings, filterable by provider_id / client_id / slot_date / status.
  getAll: async (req, res) => {
    try {
      const { provider_id, client_id, slot_date, status, limit } = req.query || {};
      const filters = {};
      if (provider_id != null) filters.provider_id = Number(provider_id);
      if (client_id != null) filters.client_id = Number(client_id);
      if (slot_date) filters.slot_date = slot_date;
      if (status) filters.status = status;

      // Anti-IDOR: a non-admin only ever sees their own bookings, whatever
      // provider_id / client_id they pass. Without this the list served every
      // booking of the platform to any authenticated account.
      if (!isAdmin(req.user)) {
        const userId = req.user?.id != null ? Number(req.user.id) : null;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (req.user?.role === 'provider') {
          const pid = await providerIdForUser(userId);
          if (pid == null) return res.json([]);
          filters.provider_id = pid;
        } else {
          filters.client_id = userId;
        }
      }

      const rows = await Booking.findAll({ filters, sort: 'slot_date', order: 'ASC', limit: Math.min(Number(limit) || 200, 500) });
      return res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  getOne: async (req, res) => {
    try {
      const row = await Booking.findById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      // Anti-IDOR: only the client, the provider of the booking, or an admin.
      if (!(await isPartyOf(row, req.user))) return res.status(403).json({ error: 'Forbidden' });
      return res.json(row);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Client requests a booking; validated against availability + existing bookings.
  create: async (req, res) => {
    try {
      const b = req.body || {};
      const providerId = Number(b.provider_id);
      const slotDate = b.slot_date;
      const slot = { start: hhmm(b.start_time), end: hhmm(b.end_time) };
      if (!providerId || !slotDate || !slot.start || !slot.end) {
        return res.status(400).json({ error: 'provider_id, slot_date, start_time, end_time are required' });
      }

      const [windows, busy] = await Promise.all([
        loadWindows(providerId, slotDate),
        loadBusy(providerId, slotDate),
      ]);
      if (!slots.isBookable(slot, windows, busy)) {
        return res.status(409).json({ error: 'Requested slot is not available' });
      }

      const row = await Booking.create({
        request_id: b.request_id ?? null,
        offer_id: b.offer_id ?? null,
        provider_id: providerId,
        client_id: req.user?.id ?? null,
        slot_date: slotDate,
        start_time: slot.start,
        end_time: slot.end,
        status: bookingStatus.BOOKING_STATUS.REQUESTED,
      });
      return res.status(201).json(row);
    } catch (err) {
      return res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  },

  confirm: async (req, res) => transitionHandler(req, res, bookingStatus.BOOKING_EVENT.CONFIRM, isProviderOf),
  decline: async (req, res) => transitionHandler(req, res, bookingStatus.BOOKING_EVENT.DECLINE, isProviderOf),
  complete: async (req, res) => transitionHandler(req, res, bookingStatus.BOOKING_EVENT.COMPLETE, isProviderOf),
  noShow: async (req, res) => transitionHandler(req, res, bookingStatus.BOOKING_EVENT.MARK_NO_SHOW, isProviderOf),

  // Either party cancels; returns the escrow outcome the caller should apply.
  cancel: async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      if (!(await isPartyOf(booking, req.user))) return res.status(403).json({ error: 'Forbidden' });

      const startAt = `${booking.slot_date}T${hhmm(booking.start_time)}:00`;
      const policy = assessCancellation({
        startAt,
        freeCancelHours: Number(process.env.BOOKING_FREE_CANCEL_HOURS) || 24,
        lateRefundPercent: Number(process.env.BOOKING_LATE_REFUND_PERCENT) || 0,
      });

      const next = await applyTransition(res, booking, bookingStatus.BOOKING_EVENT.CANCEL, {
        cancelled_by: req.user?.id ?? null,
        cancel_reason: String(req.body?.reason || '').slice(0, 500),
      });

      // The linked payment's escrow should follow `policy.suggestedEscrowEvent`
      // (see escrowController); left to the caller so booking + payment stay
      // decoupled and this endpoint works even before escrow columns exist.
      return res.json({ status: next, cancellation: policy });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  },
};

async function transitionHandler(req, res, event, authFn) {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (!(await authFn(booking, req.user))) return res.status(403).json({ error: 'Forbidden' });
    const next = await applyTransition(res, booking, event);
    return res.json({ status: next });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
  }
}
