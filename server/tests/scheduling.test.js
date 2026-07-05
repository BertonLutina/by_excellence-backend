const test = require('node:test');
const assert = require('node:assert/strict');

const slots = require('../scheduling/timeSlots');
const {
  BOOKING_STATUS, BOOKING_EVENT, apply, canApply, allowedEvents, isTerminal, BookingTransitionError,
} = require('../scheduling/bookingStatus');
const { assessCancellation, REFUND_TYPE } = require('../scheduling/cancellationPolicy');
const { ESCROW_EVENT } = require('../payments/escrow');

// --- time slots -----------------------------------------------------------

test('slots: toMinutes / fromMinutes round-trip and validation', () => {
  assert.equal(slots.toMinutes('09:30'), 570);
  assert.equal(slots.fromMinutes(570), '09:30');
  assert.equal(slots.toMinutes('24:00'), null);
  assert.equal(slots.toMinutes('9:5'), null);
});

test('slots: half-open intervals do not conflict when they touch', () => {
  assert.equal(slots.hasConflict({ start: '10:00', end: '11:00' }, [{ start: '09:00', end: '10:00' }]), false);
  assert.equal(slots.hasConflict({ start: '10:30', end: '11:30' }, [{ start: '11:00', end: '12:00' }]), true);
});

test('slots: bookable requires being inside a window and conflict-free', () => {
  const windows = [{ start: '09:00', end: '17:00' }];
  const busy = [{ start: '12:00', end: '13:00' }];
  assert.equal(slots.isBookable({ start: '10:00', end: '11:00' }, windows, busy), true);
  assert.equal(slots.isBookable({ start: '12:30', end: '13:30' }, windows, busy), false); // conflict
  assert.equal(slots.isBookable({ start: '16:30', end: '17:30' }, windows, busy), false); // outside window
});

test('slots: computeFreeSlots respects duration, step and busy times', () => {
  const free = slots.computeFreeSlots(
    [{ start: '09:00', end: '12:00' }],
    [{ start: '10:00', end: '10:30' }],
    60,
    60
  );
  const starts = free.map((s) => s.start);
  // 09:00-10:00 ok; 10:00-11:00 conflicts; 11:00-12:00 ok
  assert.deepEqual(starts, ['09:00', '11:00']);
});

test('slots: malformed slot is never bookable', () => {
  assert.equal(slots.isBookable({ start: '11:00', end: '10:00' }, [{ start: '00:00', end: '23:59' }], []), false);
});

// --- booking state machine ------------------------------------------------

test('booking: happy path requested -> confirmed -> completed', () => {
  assert.equal(apply(BOOKING_STATUS.REQUESTED, BOOKING_EVENT.CONFIRM), BOOKING_STATUS.CONFIRMED);
  assert.equal(apply(BOOKING_STATUS.CONFIRMED, BOOKING_EVENT.COMPLETE), BOOKING_STATUS.COMPLETED);
});

test('booking: can cancel from requested or confirmed, not after completion', () => {
  assert.equal(apply(BOOKING_STATUS.REQUESTED, BOOKING_EVENT.CANCEL), BOOKING_STATUS.CANCELLED);
  assert.equal(apply(BOOKING_STATUS.CONFIRMED, BOOKING_EVENT.CANCEL), BOOKING_STATUS.CANCELLED);
  assert.throws(() => apply(BOOKING_STATUS.COMPLETED, BOOKING_EVENT.CANCEL), BookingTransitionError);
});

test('booking: cannot complete a request that was never confirmed', () => {
  assert.equal(canApply(BOOKING_STATUS.REQUESTED, BOOKING_EVENT.COMPLETE), false);
});

test('booking: terminal states are dead-ends', () => {
  for (const s of [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.DECLINED, BOOKING_STATUS.NO_SHOW]) {
    assert.equal(isTerminal(s), true);
    assert.equal(allowedEvents(s).length, 0);
  }
});

// --- cancellation policy --------------------------------------------------

const START = '2026-07-10T12:00:00Z';

test('cancellation: early cancel -> full refund (escrow CANCEL)', () => {
  const r = assessCancellation({ startAt: START, now: '2026-07-08T12:00:00Z', freeCancelHours: 24 });
  assert.equal(r.refundType, REFUND_TYPE.FULL);
  assert.equal(r.suggestedEscrowEvent, ESCROW_EVENT.CANCEL);
});

test('cancellation: late cancel with no policy -> provider keeps (AUTO_RELEASE)', () => {
  const r = assessCancellation({ startAt: START, now: '2026-07-10T06:00:00Z', freeCancelHours: 24 });
  assert.equal(r.refundType, REFUND_TYPE.NONE);
  assert.equal(r.suggestedEscrowEvent, ESCROW_EVENT.AUTO_RELEASE);
});

test('cancellation: late cancel with partial policy', () => {
  const r = assessCancellation({ startAt: START, now: '2026-07-10T06:00:00Z', freeCancelHours: 24, lateRefundPercent: 50 });
  assert.equal(r.refundType, REFUND_TYPE.PARTIAL);
  assert.equal(r.refundPercent, 50);
});

test('cancellation: unknown time is conservative (full refund)', () => {
  const r = assessCancellation({ startAt: 'not-a-date' });
  assert.equal(r.refundType, REFUND_TYPE.FULL);
});
