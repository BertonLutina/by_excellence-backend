const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ESCROW_STATUS,
  ESCROW_EVENT,
  apply,
  canApply,
  allowedEvents,
  isTerminal,
  EscrowTransitionError,
} = require('../payments/escrow');

test('held -> released on delivery confirmation', () => {
  assert.equal(apply(ESCROW_STATUS.HELD, ESCROW_EVENT.CONFIRM_DELIVERY), ESCROW_STATUS.RELEASED);
});

test('held -> released on auto-release timeout', () => {
  assert.equal(apply(ESCROW_STATUS.HELD, ESCROW_EVENT.AUTO_RELEASE), ESCROW_STATUS.RELEASED);
});

test('held -> disputed when a dispute is opened', () => {
  assert.equal(apply(ESCROW_STATUS.HELD, ESCROW_EVENT.OPEN_DISPUTE), ESCROW_STATUS.DISPUTED);
});

test('held -> refunded on cancellation', () => {
  assert.equal(apply(ESCROW_STATUS.HELD, ESCROW_EVENT.CANCEL), ESCROW_STATUS.REFUNDED);
});

test('disputed resolves to released (provider) or refunded (client)', () => {
  assert.equal(apply(ESCROW_STATUS.DISPUTED, ESCROW_EVENT.RESOLVE_RELEASE), ESCROW_STATUS.RELEASED);
  assert.equal(apply(ESCROW_STATUS.DISPUTED, ESCROW_EVENT.RESOLVE_REFUND), ESCROW_STATUS.REFUNDED);
});

test('cannot confirm delivery once disputed (must resolve)', () => {
  assert.equal(canApply(ESCROW_STATUS.DISPUTED, ESCROW_EVENT.CONFIRM_DELIVERY), false);
  assert.throws(
    () => apply(ESCROW_STATUS.DISPUTED, ESCROW_EVENT.CONFIRM_DELIVERY),
    (e) => e instanceof EscrowTransitionError && e.code === 'INVALID_ESCROW_TRANSITION'
  );
});

test('terminal states accept no further events', () => {
  assert.equal(isTerminal(ESCROW_STATUS.RELEASED), true);
  assert.equal(isTerminal(ESCROW_STATUS.REFUNDED), true);
  assert.equal(isTerminal(ESCROW_STATUS.HELD), false);
  assert.equal(allowedEvents(ESCROW_STATUS.RELEASED).length, 0);
  assert.throws(() => apply(ESCROW_STATUS.RELEASED, ESCROW_EVENT.OPEN_DISPUTE), EscrowTransitionError);
  assert.throws(() => apply(ESCROW_STATUS.REFUNDED, ESCROW_EVENT.RESOLVE_RELEASE), EscrowTransitionError);
});

test('cannot re-open a dispute on an already-disputed escrow', () => {
  assert.equal(canApply(ESCROW_STATUS.DISPUTED, ESCROW_EVENT.OPEN_DISPUTE), false);
});

test('allowedEvents reflects the state', () => {
  const held = allowedEvents(ESCROW_STATUS.HELD).sort();
  assert.deepEqual(held, [
    ESCROW_EVENT.AUTO_RELEASE,
    ESCROW_EVENT.CANCEL,
    ESCROW_EVENT.CONFIRM_DELIVERY,
    ESCROW_EVENT.OPEN_DISPUTE,
  ].sort());
  assert.deepEqual(allowedEvents(ESCROW_STATUS.DISPUTED).sort(), [
    ESCROW_EVENT.RESOLVE_REFUND,
    ESCROW_EVENT.RESOLVE_RELEASE,
  ].sort());
});
