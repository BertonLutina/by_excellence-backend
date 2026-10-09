const test = require('node:test');
const assert = require('node:assert/strict');

const {
  coerceAvailable,
  normalizeProgramNote,
  sanitizeAvailabilityRow,
} = require('../utils/providerAvailabilityPublic');

test('coerceAvailable treats 0/false as busy', () => {
  assert.equal(coerceAvailable(false), false);
  assert.equal(coerceAvailable(0), false);
  assert.equal(coerceAvailable('0'), false);
  assert.equal(coerceAvailable(true), true);
  assert.equal(coerceAvailable(undefined, true), true);
});

test('normalizeProgramNote trims and caps private notes', () => {
  assert.equal(normalizeProgramNote('  Mariage Anvers  '), 'Mariage Anvers');
  assert.equal(normalizeProgramNote('   '), null);
  assert.equal(normalizeProgramNote('x'.repeat(400)).length, 280);
});

test('sanitizeAvailabilityRow hides program_note from the public', () => {
  const row = { id: 1, is_available: 0, program_note: 'Livraison Ixelles' };
  assert.equal(sanitizeAvailabilityRow(row, { canSeeProgram: true }).program_note, 'Livraison Ixelles');
  assert.equal(sanitizeAvailabilityRow(row, { canSeeProgram: false }).program_note, undefined);
});
