/**
 * Booking lifecycle state machine (Roadmap Phase 6).
 *
 *   requested ──confirm──▶ confirmed ──complete──▶ completed
 *       │                     │
 *       ├──decline──▶ declined├──cancel────▶ cancelled
 *       └──cancel───▶ cancelled└──no_show──▶ no_show
 *
 * completed / cancelled / declined / no_show are terminal. Pure logic, mirroring
 * the escrow state machine so transitions are always explicit and guarded.
 */

const BOOKING_STATUS = Object.freeze({
  REQUESTED: 'requested',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DECLINED: 'declined',
  NO_SHOW: 'no_show',
});

const BOOKING_EVENT = Object.freeze({
  CONFIRM: 'confirm',       // provider accepts
  DECLINE: 'decline',       // provider rejects a request
  CANCEL: 'cancel',         // either party cancels
  COMPLETE: 'complete',     // service delivered
  MARK_NO_SHOW: 'mark_no_show',
});

const TRANSITIONS = {
  [BOOKING_EVENT.CONFIRM]:      { from: [BOOKING_STATUS.REQUESTED], to: BOOKING_STATUS.CONFIRMED },
  [BOOKING_EVENT.DECLINE]:      { from: [BOOKING_STATUS.REQUESTED], to: BOOKING_STATUS.DECLINED },
  [BOOKING_EVENT.CANCEL]:       { from: [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.CONFIRMED], to: BOOKING_STATUS.CANCELLED },
  [BOOKING_EVENT.COMPLETE]:     { from: [BOOKING_STATUS.CONFIRMED], to: BOOKING_STATUS.COMPLETED },
  [BOOKING_EVENT.MARK_NO_SHOW]: { from: [BOOKING_STATUS.CONFIRMED], to: BOOKING_STATUS.NO_SHOW },
};

const TERMINAL = new Set([
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.CANCELLED,
  BOOKING_STATUS.DECLINED,
  BOOKING_STATUS.NO_SHOW,
]);

function isTerminal(state) {
  return TERMINAL.has(state);
}

function canApply(state, event) {
  const t = TRANSITIONS[event];
  return Boolean(t && t.from.includes(state));
}

function allowedEvents(state) {
  return Object.keys(TRANSITIONS).filter((e) => TRANSITIONS[e].from.includes(state));
}

class BookingTransitionError extends Error {
  constructor(state, event) {
    super(`Invalid booking transition: cannot apply "${event}" from "${state}".`);
    this.name = 'BookingTransitionError';
    this.code = 'INVALID_BOOKING_TRANSITION';
    this.statusCode = 409;
    this.from = state;
    this.event = event;
  }
}

function apply(state, event) {
  if (!canApply(state, event)) throw new BookingTransitionError(state, event);
  return TRANSITIONS[event].to;
}

module.exports = {
  BOOKING_STATUS,
  BOOKING_EVENT,
  TRANSITIONS,
  isTerminal,
  canApply,
  allowedEvents,
  apply,
  BookingTransitionError,
};
