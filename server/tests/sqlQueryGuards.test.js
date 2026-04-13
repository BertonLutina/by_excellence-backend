const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isSafeSqlIdentifier,
  sanitizeFilters,
  resolveSortColumn,
} = require('../utils/sqlQueryGuards');

test('isSafeSqlIdentifier rejects injection', () => {
  assert.equal(isSafeSqlIdentifier('status'), true);
  assert.equal(isSafeSqlIdentifier('created_at'), true);
  assert.equal(isSafeSqlIdentifier('id'), true);
  assert.equal(isSafeSqlIdentifier('1evil'), false);
  assert.equal(isSafeSqlIdentifier('evil;drop'), false);
  assert.equal(isSafeSqlIdentifier('a`b'), false);
  assert.equal(isSafeSqlIdentifier(''), false);
});

test('sanitizeFilters keeps only allowed columns', () => {
  const cols = ['id', 'status', 'client_id'];
  const out = sanitizeFilters(
    { status: 'active', client_id: '5', foo: 'bar', '`x`': 'y' },
    cols
  );
  assert.deepEqual(out, { status: 'active', client_id: '5' });
});

test('resolveSortColumn maps created_date to created_at when allowed', () => {
  const cols = ['id', 'created_at'];
  const r = resolveSortColumn('-created_date', 'ASC', cols);
  assert.equal(r.sortCol, 'created_at');
  assert.equal(r.sortDir, 'DESC');
});

test('resolveSortColumn falls back when invalid', () => {
  const cols = ['id', 'rating'];
  const r = resolveSortColumn('-hack;drop', 'ASC', cols, ['rating', 'id']);
  assert.equal(r.sortCol, 'rating');
});
