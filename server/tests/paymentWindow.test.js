const test = require('node:test');
const { mock } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeFinalPaymentDueDate,
  getPaymentWindowStatus,
} = require('../utils/paymentWindow');

// Ces tests construisent `event = new Date()` puis comparent au `new Date()`
// interne de getPaymentWindowStatus. L'écart (sub-ms) entre les deux appels
// faisait basculer `Math.floor((event - now) / msPerDay)` de 15 à 14 ~1 fois
// sur 20 (et menaçait aussi les bornes J-30 / J-7). On fige l'horloge sur une
// date sans bascule d'heure d'été pour rendre `daysUntilEvent` déterministe.
const FROZEN_NOW = new Date('2026-06-15T12:00:00.000Z');
test.beforeEach(() => {
  mock.timers.enable({ apis: ['Date'], now: FROZEN_NOW });
});
test.afterEach(() => {
  mock.timers.reset();
});

test('due_date is event_date minus 7 days', () => {
  const event = new Date('2026-08-01T00:00:00Z');
  const due = computeFinalPaymentDueDate(event);
  const expected = new Date('2026-07-25T00:00:00Z');
  assert.equal(due.toISOString().slice(0, 10), expected.toISOString().slice(0, 10));
});

test('status open when now is between J-30 and J-7', () => {
  const event = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000 + 60 * 1000);
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
  const event = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 60 * 1000);
  const s = getPaymentWindowStatus(event);
  assert.equal(s.status, 'open');
});

test('status open at exactly J-7 (last valid payment day)', () => {
  const event = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 1000);
  const s = getPaymentWindowStatus(event);
  assert.equal(s.status, 'open');
});

test('status overdue at J-0 (event day itself)', () => {
  const event = new Date();
  event.setHours(23, 59, 59, 0);
  const s = getPaymentWindowStatus(event);
  assert.equal(s.status, 'overdue');
});
