function serializeServiceRequestRow(row) {
  if (!row || typeof row !== 'object') return row;
  const o = { ...row };
  if (o.client_id != null && o.client_id !== '') o.client_id = Number(o.client_id);
  if (o.provider_id != null && o.provider_id !== '') o.provider_id = Number(o.provider_id);
  if (typeof o.is_combo === 'number') o.is_combo = Boolean(o.is_combo);
  return o;
}

function serializeServiceRequestRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(serializeServiceRequestRow);
}

module.exports = { serializeServiceRequestRow, serializeServiceRequestRows };
