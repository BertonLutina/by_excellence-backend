const test = require('node:test');
const assert = require('node:assert/strict');
const { validateFileBuffer } = require('../utils/fileValidation');

test('validateFileBuffer accepts minimal JPEG', () => {
  const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const r = validateFileBuffer(buf);
  assert.equal(r.mime, 'image/jpeg');
  assert.equal(r.ext, '.jpg');
});

test('validateFileBuffer accepts PNG signature', () => {
  const png = Buffer.alloc(24);
  png[0] = 0x89;
  png[1] = 0x50;
  png[2] = 0x4e;
  png[3] = 0x47;
  png[4] = 0x0d;
  png[5] = 0x0a;
  png[6] = 0x1a;
  png[7] = 0x0a;
  const r = validateFileBuffer(png);
  assert.equal(r.mime, 'image/png');
});

test('validateFileBuffer accepts WEBP', () => {
  const buf = Buffer.alloc(20);
  buf.write('RIFF', 0);
  buf.write('WEBP', 8);
  const r = validateFileBuffer(buf);
  assert.equal(r.mime, 'image/webp');
});

test('validateFileBuffer accepts PDF', () => {
  const buf = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  const r = validateFileBuffer(buf);
  assert.equal(r.mime, 'application/pdf');
});

test('validateFileBuffer rejects random bytes', () => {
  const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
  assert.throws(() => validateFileBuffer(buf), (e) => e.code === 'UNSUPPORTED_MEDIA_TYPE');
});
