const test = require('node:test');
const assert = require('node:assert/strict');
const ServiceCategory = require('../models/ServiceCategory');
const Provider = require('../models/Provider');
const ServiceItem = require('../models/ServiceItem');

test('catalog models expose goods and category activity fields', () => {
  const category = new ServiceCategory({ name: 'Boissons', category_type: 'goods', is_active: 0 });
  assert.equal(category.category_type, 'goods');
  assert.equal(category.is_active, 0);

  const provider = new Provider({
    activity_type: 'both',
    suggested_category_name: 'Accessoires ceremonie',
    suggested_category_type: 'goods',
  });
  assert.equal(provider.activity_type, 'both');
  assert.equal(provider.suggested_category_name, 'Accessoires ceremonie');
  assert.equal(provider.suggested_category_type, 'goods');

  const item = new ServiceItem({
    item_type: 'good',
    unit: 'caisse',
    stock_quantity: 20,
    min_order_quantity: 2,
  });
  assert.equal(item.item_type, 'good');
  assert.equal(item.unit, 'caisse');
  assert.equal(item.stock_quantity, 20);
  assert.equal(item.min_order_quantity, 2);
});
