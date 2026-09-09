/**
 * mysql2 often returns DECIMAL columns as strings; JSON clients expect numbers for rating/price_from.
 */
function serializeProviderRow(row) {
  if (!row || typeof row !== 'object') return row;
  const o = { ...row };
  // GET /providers and GET /providers/:id are PUBLIC (optionalAuth). Never leak
  // the raw Stripe Connect account id or the internal opt-in timestamp — only
  // the derived status/payouts flags are safe to show (used for UI badges).
  delete o.stripe_account_id;
  delete o.stripe_connect_requested_at;
  if (o.stripe_connect_status == null) o.stripe_connect_status = 'none';
  o.stripe_payouts_enabled = Boolean(Number(o.stripe_payouts_enabled) || 0);
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
  return o;
}

function serializeProviderRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(serializeProviderRow);
}

module.exports = { serializeProviderRow, serializeProviderRows };
