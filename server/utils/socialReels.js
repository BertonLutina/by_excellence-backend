const { coercePortfolioImages, bindJsonDocument, PortfolioImagesParseError } = require('./portfolioImages');

const MAX_REELS_PER_PLATFORM = 8;
const MAX_URL_LENGTH = 500;
const PLATFORMS = ['tiktok', 'instagram', 'facebook', 'youtube'];

const EMPTY_SOCIAL_REELS = Object.freeze({
  tiktok: [],
  instagram: [],
  facebook: [],
  youtube: [],
});

function emptySocialReels() {
  return {
    tiktok: [],
    instagram: [],
    facebook: [],
    youtube: [],
  };
}

function normalizeReelUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const href = parsed.href.slice(0, MAX_URL_LENGTH);
  return href;
}

function coerceUrlList(value) {
  if (value == null) return [];
  const parsed = Array.isArray(value) ? value : coercePortfolioImages(value);
  if (!Array.isArray(parsed)) return [];
  const out = [];
  const seen = new Set();
  for (const item of parsed) {
    const url = normalizeReelUrl(item);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_REELS_PER_PLATFORM) break;
  }
  return out;
}

function coerceSocialReels(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return emptySocialReels();

  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return emptySocialReels();
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return emptySocialReels();
  }

  const out = emptySocialReels();
  for (const platform of PLATFORMS) {
    out[platform] = coerceUrlList(parsed[platform]);
  }
  return out;
}

/**
 * Keep reel slots only for platforms that still have a profile URL.
 * Called when both social_reels and profile URLs are present on update.
 */
function filterSocialReelsByProfileLinks(reels, profile = {}) {
  const base = coerceSocialReels(reels) || emptySocialReels();
  const out = emptySocialReels();
  const has = (key) => Boolean(String(profile[key] || '').trim());
  if (has('tiktok_url')) out.tiktok = base.tiktok;
  if (has('instagram_url')) out.instagram = base.instagram;
  if (has('facebook_url')) out.facebook = base.facebook;
  if (has('youtube_url')) out.youtube = base.youtube;
  return out;
}

function bindSocialReels(value) {
  const normalized = coerceSocialReels(value);
  if (normalized === undefined) return undefined;
  return bindJsonDocument(normalized);
}

function parseStoredSocialReels(value) {
  return coerceSocialReels(value === undefined ? null : value) || emptySocialReels();
}

module.exports = {
  MAX_REELS_PER_PLATFORM,
  MAX_URL_LENGTH,
  PLATFORMS,
  EMPTY_SOCIAL_REELS,
  emptySocialReels,
  normalizeReelUrl,
  coerceSocialReels,
  filterSocialReelsByProfileLinks,
  bindSocialReels,
  parseStoredSocialReels,
  SocialReelsParseError: PortfolioImagesParseError,
};
