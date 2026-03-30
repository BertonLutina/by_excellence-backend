/**
 * mysql2 often returns DECIMAL columns as strings; JSON clients expect numbers for rating/price_from.
 */
function serializeProviderRow(row) {
  if (!row || typeof row !== 'object') return row;
  const o = { ...row };
  if (o.rating != null && o.rating !== '') o.rating = Number(o.rating);
  if (o.price_from != null && o.price_from !== '') o.price_from = Number(o.price_from);
  if (o.review_count != null && o.review_count !== '') o.review_count = Number(o.review_count);
  if (o.premium_commission_percent != null && o.premium_commission_percent !== '') {
    o.premium_commission_percent = Number(o.premium_commission_percent);
  }
  if (o.category_id != null && o.category_id !== '') o.category_id = Number(o.category_id);
  if (o.worker_count != null && o.worker_count !== '') o.worker_count = Number(o.worker_count);
  return o;
}

function serializeProviderRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(serializeProviderRow);
}

module.exports = { serializeProviderRow, serializeProviderRows };
