const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canUsePersonalPlanning,
  sanitizePlanningPayload,
  normalizeTitle,
  normalizeTime,
} = require('../utils/personalPlanning');

test('only admin and provider may use personal planning', () => {
  assert.equal(canUsePersonalPlanning('admin'), true);
  assert.equal(canUsePersonalPlanning('provider'), true);
  assert.equal(canUsePersonalPlanning('client'), false);
  assert.equal(canUsePersonalPlanning(''), false);
});

test('sanitizePlanningPayload requires a title and normalizes fields', () => {
  const ok = sanitizePlanningPayload({
    title: '  Appeler le client  ',
    notes: '  après-midi  ',
    plan_date: '2026-10-09',
    start_time: '09:30',
    end_time: '10:00',
    is_done: '1',
  });
  assert.equal(ok.error, undefined);
  assert.equal(ok.data.title, 'Appeler le client');
  assert.equal(ok.data.notes, 'après-midi');
  assert.equal(ok.data.plan_date, '2026-10-09');
  assert.equal(ok.data.start_time, '09:30:00');
  assert.equal(ok.data.end_time, '10:00:00');
  assert.equal(ok.data.is_done, true);

  const bad = sanitizePlanningPayload({ title: '   ' });
  assert.equal(bad.error, 'title is required');
});

test('partial update can toggle done without title', () => {
  const parsed = sanitizePlanningPayload({ is_done: false }, { partial: true });
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.data.is_done, false);
  assert.equal(parsed.data.title, undefined);
});

test('normalize helpers cap title and reject bad times', () => {
  assert.equal(normalizeTitle('x'.repeat(250)).length, 200);
  assert.equal(normalizeTime('25:99'), undefined);
  assert.equal(normalizeTime(''), null);
});
