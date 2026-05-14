const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeFinalPaymentDueDate,
  getPaymentWindowStatus,
} = require('../utils/paymentWindow');

test('due_date is event_date minus 7 days', () => {
  const event = new Date('2026-08-01T00:00:00Z');
  const due = computeFinalPaymentDueDate(event);
  const expected = new Date('2026-07-25T00:00:00Z');
  assert.equal(due.toISOString().slice(0, 10), expected.toISOString().slice(0, 10));
});

test('status open when now is between J-30 and J-7', () => {
  const event = new Date();
  event.setDate(event.getDate() + 15);
  const s = getPaymentWindowStatus(event);
  assert.equal(s.status, 'open');
  assert.equal(s.daysUntilEvent, 15);
});

test('status not_yet when now is before J-30', () => {
  const event = new Date();
  event.setDate(event.getDate() + 45);
  const s = getPaymentWindowStatus(event);
  assert.equal(s.status, 'not_yet');
  assert.ok(s.daysUntilOpen > 0);
});

test('status overdue when now is past J-7', () => {
  const event = new Date();
  event.setDate(event.getDate() + 3);
  const s = getPaymentWindowStatus(event);
  assert.equal(s.status, 'overdue');
});

test('status no_date when event date is null', () => {
  const s = getPaymentWindowStatus(null);
  assert.equal(s.status, 'no_date');
});

test('status open at exactly J-30 (window opens that day)', () => {
  const event = new Date();
  event.setDate(event.getDate() + 30);
  const s = getPaymentWindowStatus(event);
  assert.equal(s.status, 'open');
});

test('status open at exactly J-7 (last valid payment day)', () => {
  const event = new Date();
  event.setDate(event.getDate() + 7);
  const s = getPaymentWindowStatus(event);
  assert.equal(s.status, 'open');
});

test('status overdue at J-0 (event day itself)', () => {
  const event = new Date();
  event.setHours(23, 59, 59, 0);
  const s = getPaymentWindowStatus(event);
  assert.equal(s.status, 'overdue');
});
