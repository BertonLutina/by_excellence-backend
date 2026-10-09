/**
 * Escrow state machine (Roadmap Phase 2).
 *
 * Escrow tracks the fate of funds a client has already paid, held by the platform
 * until the service is delivered. It is a SEPARATE dimension from Payment.status
 * (which stays 'pending' | 'paid' | 'refunded' as today); a paid payment gains an
 * `escrow_status` so we can hold, release, or refund it safely.
 *
 * Lifecycle:
 *
 *        (client pays)
 *            │
 *            ▼
 *          held ──confirm/auto_release──▶ released   (net is due; funds stay on the platform)
 *            │
 *            ├── open_dispute ──▶ disputed ──resolve_release──▶ released
 *            │                        └──────resolve_refund───▶ refunded
 *            │
 *            └── cancel ──▶ refunded   (before delivery)
 *
 * released / refunded are terminal.
 *
 * This module is PURE logic (no DB, no gateway) so it is trivially testable and
 * can be reused by controllers, jobs (auto-release), and the admin dispute tool.
 */

const ESCROW_STATUS = Object.freeze({
  HELD: 'held',
  DISPUTED: 'disputed',
  RELEASED: 'released',
  REFUNDED: 'refunded',
});

const ESCROW_EVENT = Object.freeze({
  CONFIRM_DELIVERY: 'confirm_delivery', // client confirms the service was delivered
  AUTO_RELEASE: 'auto_release',         // timeout elapsed with no dispute
  OPEN_DISPUTE: 'open_dispute',         // client or provider raises an issue
  RESOLVE_RELEASE: 'resolve_release',   // admin sides with provider
  RESOLVE_REFUND: 'resolve_refund',     // admin sides with client
  CANCEL: 'cancel',                     // cancelled before delivery
});

// event -> { from: [allowed states], to: resulting state }
const TRANSITIONS = {
  [ESCROW_EVENT.CONFIRM_DELIVERY]: { from: [ESCROW_STATUS.HELD], to: ESCROW_STATUS.RELEASED },
  [ESCROW_EVENT.AUTO_RELEASE]:     { from: [ESCROW_STATUS.HELD], to: ESCROW_STATUS.RELEASED },
  [ESCROW_EVENT.OPEN_DISPUTE]:     { from: [ESCROW_STATUS.HELD], to: ESCROW_STATUS.DISPUTED },
  [ESCROW_EVENT.RESOLVE_RELEASE]:  { from: [ESCROW_STATUS.DISPUTED], to: ESCROW_STATUS.RELEASED },
  [ESCROW_EVENT.RESOLVE_REFUND]:   { from: [ESCROW_STATUS.DISPUTED], to: ESCROW_STATUS.REFUNDED },
  [ESCROW_EVENT.CANCEL]:           { from: [ESCROW_STATUS.HELD], to: ESCROW_STATUS.REFUNDED },
};

const TERMINAL = new Set([ESCROW_STATUS.RELEASED, ESCROW_STATUS.REFUNDED]);

function isTerminal(state) {
  return TERMINAL.has(state);
}

/** Would this event be allowed from the current state? */
function canApply(state, event) {
  const t = TRANSITIONS[event];
  return Boolean(t && t.from.includes(state));
}

/** Events currently allowed from a state. */
function allowedEvents(state) {
  return Object.keys(TRANSITIONS).filter((e) => TRANSITIONS[e].from.includes(state));
}

class EscrowTransitionError extends Error {
  constructor(state, event) {
    super(`Invalid escrow transition: cannot apply "${event}" from "${state}".`);
    this.name = 'EscrowTransitionError';
    this.code = 'INVALID_ESCROW_TRANSITION';
    this.statusCode = 409;
    this.from = state;
    this.event = event;
  }
}

/**
 * Apply an event to a state, returning the next state.
 * Throws EscrowTransitionError if the transition isn't allowed.
 * @param {string} state current ESCROW_STATUS
 * @param {string} event ESCROW_EVENT
 * @returns {string} next ESCROW_STATUS
 */
function apply(state, event) {
  if (!canApply(state, event)) throw new EscrowTransitionError(state, event);
  return TRANSITIONS[event].to;
}

module.exports = {
  ESCROW_STATUS,
  ESCROW_EVENT,
  TRANSITIONS,
  isTerminal,
  canApply,
  allowedEvents,
  apply,
  EscrowTransitionError,
};
