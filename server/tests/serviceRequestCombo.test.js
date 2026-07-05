const test = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveIsCombo,
  normalizeProviderId,
  normalizeComboPayload,
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

test('normalizeComboPayload assigns lead role and trims notes', () => {
  const out = normalizeComboPayload(
    {
      lines: [
        { provider_id: 42, note: '  Site web  ' },
        { provider_id: 17, note: 'Photos' },
      ],
      common_notes: '  Budget global  ',
    },
    42
  );
  assert.ok(out);
  assert.equal(out.primary_provider_id, 42);
  assert.equal(out.common_notes, 'Budget global');
  assert.equal(out.lines.length, 2);
  assert.equal(out.lines[0].role, 'lead');
  assert.equal(out.lines[0].note, 'Site web');
  assert.equal(out.lines[1].role, 'partner');
});

test('normalizeComboPayload returns null for single provider', () => {
  assert.equal(
    normalizeComboPayload({ lines: [{ provider_id: 1 }] }, 1),
    null
  );
});
