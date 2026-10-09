const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeImageCrop } = require('../utils/imageCrop');

test('a crop rectangle is stored as fractions of the source image', () => {
  const parsed = normalizeImageCrop({ x: 0.25, y: 0, w: 0.5, h: 1 });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, { x: 0.25, y: 0, w: 0.5, h: 1 });
});

test('an empty crop clears the saved framing', () => {
  assert.deepEqual(normalizeImageCrop(null), { ok: true, value: null });
  assert.deepEqual(normalizeImageCrop(''), { ok: true, value: null });
});

test('a crop that leaves the image is rejected', () => {
  assert.equal(normalizeImageCrop({ x: 0.8, y: 0, w: 0.5, h: 1 }).ok, false);
  assert.equal(normalizeImageCrop({ x: 0, y: 0, w: 0, h: 1 }).ok, false);
  assert.equal(normalizeImageCrop('not-json').ok, false);
});
