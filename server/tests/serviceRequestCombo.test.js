const test = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveIsCombo,
  normalizeProviderId,
  COMBO_MARKER,
} = require('../utils/serviceRequestCombo');

test('normalizeProviderId accepts positive integers', () => {
  assert.equal(normalizeProviderId(5), 5);
  assert.equal(normalizeProviderId('12'), 12);
  assert.equal(normalizeProviderId(null), null);
  assert.equal(normalizeProviderId('x'), null);
});

test('deriveIsCombo from marker in service_description', () => {
  assert.equal(
    deriveIsCombo({ service_description: `${COMBO_MARKER}\nline` }),
    true
  );
  assert.equal(deriveIsCombo({ service_description: 'plain text' }), false);
});

test('deriveIsCombo from is_combo flag', () => {
  assert.equal(deriveIsCombo({ is_combo: true, service_description: 'x' }), true);
  assert.equal(deriveIsCombo({ is_combo: 'true', service_description: 'x' }), true);
});
