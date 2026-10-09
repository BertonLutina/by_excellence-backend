const test = require('node:test');
const assert = require('node:assert/strict');
const {
  coerceSocialReels,
  filterSocialReelsByProfileLinks,
  bindSocialReels,
  MAX_REELS_PER_PLATFORM,
} = require('../utils/socialReels');
const Provider = require('../models/Provider');

test('social reels keep up to 8 valid https urls per platform', () => {
  const many = Array.from({ length: 12 }, (_, i) => `https://www.tiktok.com/@x/video/${i + 1}`);
  const out = coerceSocialReels({
    tiktok: many,
    instagram: ['instagram.com/reel/ABC/', '', 'not a url:::'],
    facebook: null,
  });
  assert.equal(out.tiktok.length, MAX_REELS_PER_PLATFORM);
  assert.equal(out.instagram.length, 1);
  assert.match(out.instagram[0], /^https:\/\//);
  assert.deepEqual(out.facebook, []);
  assert.deepEqual(out.youtube, []);
});

test('filterSocialReelsByProfileLinks drops platforms without profile link', () => {
  const filtered = filterSocialReelsByProfileLinks(
    {
      tiktok: ['https://www.tiktok.com/@x/video/1'],
      instagram: ['https://www.instagram.com/reel/ABC/'],
      youtube: ['https://www.youtube.com/shorts/abcdEFGHijk'],
    },
    { tiktok_url: 'https://tiktok.com/@x', instagram_url: '', youtube_url: 'https://youtube.com/@x' }
  );
  assert.equal(filtered.tiktok.length, 1);
  assert.deepEqual(filtered.instagram, []);
  assert.equal(filtered.youtube.length, 1);
  assert.deepEqual(filtered.facebook, []);
});

test('Provider binds social_reels as JSON text and filters by profile urls in payload', () => {
  const p = new Provider({
    tiktok_url: 'https://tiktok.com/@demo',
    instagram_url: '',
    facebook_url: '',
    youtube_url: '',
    social_reels: {
      tiktok: ['https://www.tiktok.com/@demo/video/99'],
      instagram: ['https://www.instagram.com/reel/ZZZ/'],
    },
  });
  const parsed = JSON.parse(p.social_reels);
  assert.equal(parsed.tiktok.length, 1);
  assert.deepEqual(parsed.instagram, []);
  assert.ok(typeof bindSocialReels({ tiktok: ['https://tiktok.com/@a/video/1'] }) === 'string');
});
