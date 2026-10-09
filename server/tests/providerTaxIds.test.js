const test = require('node:test');
const assert = require('node:assert/strict');

const { assertProviderCanBeActivated, hasTaxValue } = require('../utils/providerTaxIds');

test('hasTaxValue rejects empty / whitespace', () => {
  assert.equal(hasTaxValue(null), false);
  assert.equal(hasTaxValue(''), false);
  assert.equal(hasTaxValue('   '), false);
  assert.equal(hasTaxValue('BE0123456789'), true);
});

test('activation allowed when VAT and BCE are present', () => {
  const gate = assertProviderCanBeActivated({
    vat_number: 'BE0123456789',
    siret: '0123456789',
  });
  assert.equal(gate.ok, true);
});

test('activation blocked when VAT is missing', () => {
  const gate = assertProviderCanBeActivated({
    vat_number: '',
    siret: '0123456789',
  });
  assert.equal(gate.ok, false);
  assert.equal(gate.code, 'PROVIDER_TAX_IDS_REQUIRED');
  assert.deepEqual(gate.missing, ['vat_number']);
  assert.match(gate.error, /TVA/i);
});

test('activation blocked when BCE is missing', () => {
  const gate = assertProviderCanBeActivated({
    vat_number: 'BE0123456789',
    siret: null,
  });
  assert.equal(gate.ok, false);
  assert.deepEqual(gate.missing, ['siret']);
  assert.match(gate.error, /BCE/i);
});

test('activation blocked when both are missing', () => {
  const gate = assertProviderCanBeActivated({});
  assert.equal(gate.ok, false);
  assert.deepEqual(gate.missing, ['vat_number', 'siret']);
});
