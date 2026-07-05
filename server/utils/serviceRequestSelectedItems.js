const { executeSQL } = require('../db/db');

function parseSelectedItemsInput(raw) {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Validate catalog lines belong to provider; snapshot title/price from DB.
 * @returns {Promise<{ items: object[]|null, error: string|null }>}
 */
async function validateAndNormalizeSelectedItems(providerId, rawItems) {
  const input = parseSelectedItemsInput(rawItems);
  if (input.length === 0) return { items: [], error: null };

  const pid = Number(providerId);
  if (!Number.isFinite(pid) || pid <= 0) {
    return { items: null, error: 'Invalid provider_id for selected_items' };
  }

  const ids = [];
  const qtyById = new Map();
  for (const line of input) {
    const id = Number(line?.service_item_id ?? line?.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const q = Math.max(1, Math.min(99, Number(line?.quantity) || 1));
    if (!qtyById.has(id)) ids.push(id);
    qtyById.set(id, q);
  }

  if (ids.length === 0) {
    return { items: null, error: 'selected_items must include valid service_item_id values' };
  }

  const placeholders = ids.map(() => '?').join(', ');
  const rows = await executeSQL(
    `SELECT id, provider_id, item_type, title, price, price_type, is_active
     FROM service_items
     WHERE id IN (${placeholders})`,
    ids
  );
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  const byId = new Map(list.map((r) => [Number(r.id), r]));

  const normalized = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) {
      return { items: null, error: `service_item_id ${id} not found` };
    }
    if (Number(row.provider_id) !== pid) {
      return { items: null, error: `service_item_id ${id} does not belong to this provider` };
    }
    if (row.is_active === 0 || row.is_active === false) {
      return { items: null, error: `service_item_id ${id} is not available` };
    }
    normalized.push({
      service_item_id: id,
      item_type: row.item_type || 'service',
      title: String(row.title || '').trim() || `Item #${id}`,
      quantity: qtyById.get(id) || 1,
      unit_price: row.price != null ? Number(row.price) : null,
      price_type: row.price_type || 'fixed',
    });
  }

  return { items: normalized, error: null };
}

function buildDescriptionFromSelectedItems(items, userNotes = '') {
  const lines = (items || []).map((it, i) => {
    const kind = it.item_type === 'package' ? 'Formule' : 'Service';
    const price =
      it.unit_price != null && it.price_type !== 'on_quote'
        ? ` — ${it.unit_price}€${it.price_type === 'hourly' ? '/h' : ''}`
        : it.price_type === 'on_quote'
          ? ' — sur devis'
          : '';
    const qty = Number(it.quantity) > 1 ? ` x${it.quantity}` : '';
    return `${i + 1}. [${kind}] ${it.title}${qty}${price} (ref. #${it.service_item_id})`;
  });
  const header = '=== PRESTATIONS SÉLECTIONNÉES ===\n\n';
  const body = lines.join('\n');
  const notes = String(userNotes || '').trim();
  const notesBlock = notes ? `\n\n=== NOTES COMPLÉMENTAIRES ===\n${notes}` : '';
  return `${header}${body}${notesBlock}`;
}

module.exports = {
  parseSelectedItemsInput,
  validateAndNormalizeSelectedItems,
  buildDescriptionFromSelectedItems,
};
