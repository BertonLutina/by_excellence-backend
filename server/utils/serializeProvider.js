const { parseStoredImageCrop } = require('./imageCrop');
const { parseStoredSocialReels } = require('./socialReels');

/**
 * mysql2 often returns DECIMAL columns as strings; JSON clients expect numbers for rating/price_from.
 */
function serializeProviderRow(row) {
  if (!row || typeof row !== 'object') return row;
  const o = { ...row };
  // Older databases may still have unused Stripe Connect columns. Never expose them.
  delete o.stripe_account_id;
  delete o.stripe_connect_status;
  delete o.stripe_payouts_enabled;
  delete o.stripe_connect_requested_at;
  if (o.rating != null && o.rating !== '') o.rating = Number(o.rating);
  if (o.price_from != null && o.price_from !== '') o.price_from = Number(o.price_from);
  if (o.review_count != null && o.review_count !== '') o.review_count = Number(o.review_count);
  if (o.premium_commission_percent != null && o.premium_commission_percent !== '') {
    o.premium_commission_percent = Number(o.premium_commission_percent);
  }
  if (o.category_id != null && o.category_id !== '') o.category_id = Number(o.category_id);
  if (o.worker_count != null && o.worker_count !== '') o.worker_count = Number(o.worker_count);
  if (o.lat != null && o.lat !== '') o.lat = Number(o.lat);
  if (o.lng != null && o.lng !== '') o.lng = Number(o.lng);
  if (typeof o.career_highlights === 'string') {
    try {
      o.career_highlights = JSON.parse(o.career_highlights);
    } catch {
      o.career_highlights = [];
    }
  }
  if (!Array.isArray(o.career_highlights)) o.career_highlights = [];
  if (Object.prototype.hasOwnProperty.call(o, 'social_reels') || o.social_reels == null) {
    o.social_reels = parseStoredSocialReels(o.social_reels);
  }
  if (Object.prototype.hasOwnProperty.call(o, 'photo_crop')) o.photo_crop = parseStoredImageCrop(o.photo_crop);
  if (Object.prototype.hasOwnProperty.call(o, 'banner_crop')) o.banner_crop = parseStoredImageCrop(o.banner_crop);
  return o;
}

function serializeProviderRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(serializeProviderRow);
}

module.exports = { serializeProviderRow, serializeProviderRows };
