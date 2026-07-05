const test = require('node:test');
const assert = require('node:assert/strict');

const { haversineKm, withinRadius } = require('../discovery/geo');
const { searchProviders } = require('../discovery/search');
const { generateReferralCode, normalizeReferralCode, isValidReferralCode } = require('../discovery/referral');

// --- geo ------------------------------------------------------------------

test('geo: known distance Abidjan <-> Lagos (~400km)', () => {
  const abidjan = { lat: 5.36, lng: -4.0083 };
  const lagos = { lat: 6.5244, lng: 3.3792 };
  const d = haversineKm(abidjan, lagos);
  assert.ok(d > 750 && d < 830, `got ${d}`);
});

test('geo: invalid coords return null / false', () => {
  assert.equal(haversineKm({ lat: 5, lng: 'x' }, { lat: 6, lng: 3 }), null);
  assert.equal(withinRadius({ lat: 5, lng: -4 }, { lat: 5.01, lng: -4.01 }, 5), true);
  assert.equal(withinRadius({ lat: 5, lng: -4 }, { lat: 6.5, lng: 3.4 }, 50), false);
});

// --- search + ranking -----------------------------------------------------

const providers = [
  { id: 1, display_name: 'Ama Events', profession: 'Traiteur', city: 'Abidjan', lat: 5.36, lng: -4.0083, category_id: 2, price_from: 100, rating: 4.8, review_count: 40, is_verified: 1, provider_tier: 'premium', status: 'active' },
  { id: 2, display_name: 'Kofi Sound', profession: 'DJ', city: 'Abidjan', lat: 5.35, lng: -4.02, category_id: 3, price_from: 50, rating: 4.2, review_count: 10, is_verified: 0, provider_tier: 'standard', status: 'active' },
  { id: 3, display_name: 'Zara Decor', profession: 'Décoration', city: 'Lagos', lat: 6.52, lng: 3.37, category_id: 2, price_from: 300, rating: 5.0, review_count: 5, is_verified: 1, provider_tier: 'standard', status: 'active' },
  { id: 4, display_name: 'Old Inactive', profession: 'Traiteur', city: 'Abidjan', lat: 5.36, lng: -4.0, category_id: 2, price_from: 90, rating: 4.9, review_count: 99, is_verified: 1, provider_tier: 'premium', status: 'inactive' },
];

test('search: excludes inactive providers by default', () => {
  const res = searchProviders(providers, {});
  assert.deepEqual(res.map((p) => p.id).sort(), [1, 2, 3]);
});

test('search: category filter', () => {
  const res = searchProviders(providers, { categoryId: 2 });
  assert.deepEqual(res.map((p) => p.id).sort(), [1, 3]);
});

test('search: price range filter', () => {
  const res = searchProviders(providers, { priceMin: 60, priceMax: 200 });
  assert.deepEqual(res.map((p) => p.id), [1]);
});

test('search: verifiedOnly + minRating', () => {
  const res = searchProviders(providers, { verifiedOnly: true, minRating: 4.9 });
  assert.deepEqual(res.map((p) => p.id), [3]);
});

test('search: text query matches name/profession', () => {
  const res = searchProviders(providers, { query: 'traiteur' });
  assert.deepEqual(res.map((p) => p.id), [1]); // #4 is inactive
});

test('search: near me filters by radius and adds distance', () => {
  const res = searchProviders(providers, { near: { lat: 5.36, lng: -4.0083, radiusKm: 20 } });
  const ids = res.map((p) => p.id).sort();
  assert.deepEqual(ids, [1, 2]); // Lagos (#3) excluded
  assert.ok(res.every((p) => typeof p._distanceKm === 'number'));
});

test('search: ranking puts verified premium high-rating first', () => {
  const res = searchProviders(providers, {});
  assert.equal(res[0].id, 1); // Ama: 4.8, 40 reviews, verified, premium
  assert.ok(res[0]._score > res[res.length - 1]._score);
});

test('search: limit caps results', () => {
  assert.equal(searchProviders(providers, { limit: 1 }).length, 1);
});

// --- referral -------------------------------------------------------------

test('referral: generated codes are valid and prefixed', () => {
  for (let i = 0; i < 50; i += 1) {
    const code = generateReferralCode();
    assert.match(code, /^BYX-[A-Z2-9]{6}$/);
    assert.equal(isValidReferralCode(code), true);
  }
});

test('referral: generation avoids ambiguous chars (0,O,1,I)', () => {
  const seq = [0.99, 0, 0, 0, 0, 0]; // maps to last / first alphabet chars
  let i = 0;
  const code = generateReferralCode(() => seq[i++ % seq.length]);
  assert.doesNotMatch(code, /[01OI]/);
});

test('referral: normalize tolerates lowercase, spaces, missing dash', () => {
  assert.equal(normalizeReferralCode(' byx7f3k9q '), 'BYX-7F3K9Q');
  assert.equal(normalizeReferralCode('BYX-7F3K9Q'), 'BYX-7F3K9Q');
});

test('referral: invalid codes rejected', () => {
  assert.equal(isValidReferralCode('XYZ-123456'), false);
  assert.equal(isValidReferralCode('BYX-0O1I55'), false); // ambiguous chars not in alphabet
  assert.equal(isValidReferralCode(''), false);
});
