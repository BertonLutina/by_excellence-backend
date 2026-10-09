const test = require('node:test');
const assert = require('node:assert/strict');
const { coerceCareerHighlights, bindCareerHighlights } = require('../utils/careerHighlights');
const Provider = require('../models/Provider');

test('career highlights keep title, year and place and drop empty rows', () => {
  const out = coerceCareerHighlights([
    { title: '  Mariage Anvers  ', year: '2024', place: 'Anvers', description: '300 invités' },
    { title: '   ' },
    { year: '2023' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'Mariage Anvers');
  assert.equal(out[0].year, '2024');
});

test('Provider binds career_highlights as JSON text', () => {
  const p = new Provider({
    career_highlights: [{ title: 'Festival', year: '2022', place: 'Bruxelles' }],
  });
  assert.equal(JSON.parse(p.career_highlights)[0].title, 'Festival');
  assert.ok(typeof bindCareerHighlights([{ title: 'A' }]) === 'string');
});
