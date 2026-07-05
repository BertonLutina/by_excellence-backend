/**
 * Cancellation policy (Roadmap Phase 6) — decides what happens to escrowed funds
 * when a booking is cancelled, based on how much notice was given.
 *
 * Default rule: cancelling at least `freeCancelHours` before the start = full
 * refund to the client; later than that = provider keeps it (protects providers
 * from last-minute cancellations). A `lateRefundPercent` allows a partial refund
 * for late cancellations if desired.
 *
 * The decision maps to an escrow event so the caller can act on the held funds.
 */
const { ESCROW_EVENT } = require('../payments/escrow');

const REFUND_TYPE = Object.freeze({ FULL: 'full', PARTIAL: 'partial', NONE: 'none' });

function hoursBetween(from, to) {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return (b - a) / (1000 * 60 * 60);
}

/**
 * @param {Object} opts
 * @param {string|Date|number} opts.startAt   booking start
 * @param {string|Date|number} [opts.now]     defaults to Date.now()
 * @param {number} [opts.freeCancelHours=24]  full-refund cutoff
 * @param {number} [opts.lateRefundPercent=0] refund % for late cancellations (0–100)
 * @returns {{ refundType:string, refundPercent:number, hoursUntilStart:number|null, suggestedEscrowEvent:string }}
 */
function assessCancellation(opts = {}) {
  const { startAt, now = Date.now(), freeCancelHours = 24, lateRefundPercent = 0 } = opts;
  const hoursUntilStart = hoursBetween(now, startAt);

  // If we can't tell the time, be conservative: full refund to the client.
  if (hoursUntilStart == null) {
    return {
      refundType: REFUND_TYPE.FULL,
      refundPercent: 100,
      hoursUntilStart: null,
      suggestedEscrowEvent: ESCROW_EVENT.CANCEL,
    };
  }

  const inTime = hoursUntilStart >= Number(freeCancelHours);
  if (inTime) {
    return {
      refundType: REFUND_TYPE.FULL,
      refundPercent: 100,
      hoursUntilStart,
      suggestedEscrowEvent: ESCROW_EVENT.CANCEL, // held -> refunded
    };
  }

  const pct = Math.max(0, Math.min(100, Number(lateRefundPercent) || 0));
  if (pct >= 100) {
    return { refundType: REFUND_TYPE.FULL, refundPercent: 100, hoursUntilStart, suggestedEscrowEvent: ESCROW_EVENT.CANCEL };
  }
  if (pct > 0) {
    // Partial refunds need explicit handling (refund pct, release the rest).
    return { refundType: REFUND_TYPE.PARTIAL, refundPercent: pct, hoursUntilStart, suggestedEscrowEvent: 'partial_refund' };
  }
  return {
    refundType: REFUND_TYPE.NONE,
    refundPercent: 0,
    hoursUntilStart,
    suggestedEscrowEvent: ESCROW_EVENT.AUTO_RELEASE, // held -> released (provider keeps)
  };
}

module.exports = { assessCancellation, REFUND_TYPE };
