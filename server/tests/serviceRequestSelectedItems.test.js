const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDescriptionFromSelectedItems,
} = require('../utils/serviceRequestSelectedItems');

test('buildDescriptionFromSelectedItems labels selected goods as biens', () => {
  const description = buildDescriptionFromSelectedItems([
    {
      service_item_id: 42,
      item_type: 'good',
      title: 'Caisse de jus',
      quantity: 3,
      unit_price: 18,
      price_type: 'fixed',
    },
  ]);

  assert.match(description, /\[Bien\] Caisse de jus x3 — 18€/);
  assert.doesNotMatch(description, /\[Service\] Caisse de jus/);
});
