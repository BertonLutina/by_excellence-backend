function serializeServiceRequestRow(row) {
  if (!row || typeof row !== 'object') return row;
  const o = { ...row };
  if (o.client_id != null && o.client_id !== '') o.client_id = Number(o.client_id);
  if (o.provider_id != null && o.provider_id !== '') o.provider_id = Number(o.provider_id);
  if (o.partnership_id != null && o.partnership_id !== '') o.partnership_id = Number(o.partnership_id);
  if (typeof o.is_combo === 'number') o.is_combo = Boolean(o.is_combo);
  if (typeof o.is_open_request === 'number') o.is_open_request = Boolean(o.is_open_request);
  if (typeof o.selected_items === 'string') {
    try {
      o.selected_items = JSON.parse(o.selected_items);
    } catch {
      o.selected_items = null;
    }
  }
  if (typeof o.combo_payload === 'string') {
    try {
      o.combo_payload = JSON.parse(o.combo_payload);
    } catch {
      o.combo_payload = null;
    }
  }
  return o;
}

function serializeServiceRequestRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(serializeServiceRequestRow);
}

module.exports = { serializeServiceRequestRow, serializeServiceRequestRows };
