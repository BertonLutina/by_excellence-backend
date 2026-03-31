const { executeSQL } = require('../db/db');

const COMBO_MARKER = '=== DEMANDE COMBO ===';

function normalizeProviderId(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function deriveIsCombo(body) {
  if (body.is_combo === true || body.is_combo === 'true') return true;
  const desc = body.service_description;
  if (typeof desc === 'string' && desc.includes(COMBO_MARKER)) return true;
  return false;
}

/**
 * When structured combo_payload is sent, validates lines, uniqueness, and provider existence.
 * @returns {Promise<string|null>} error message or null
 */
async function validateComboPayloadStructured(combo_payload) {
  if (combo_payload == null || typeof combo_payload !== 'object') {
    return 'combo_payload must be an object when provided';
  }
  const lines = combo_payload.lines;
  if (!Array.isArray(lines)) {
    return 'combo_payload.lines must be an array';
  }
  if (lines.length < 2) {
    return 'combo_payload must include at least 2 distinct providers';
  }
  const ids = [];
  for (const line of lines) {
    const pid = normalizeProviderId(line?.provider_id);
    if (!pid) return 'Each combo line must include a valid provider_id';
    ids.push(pid);
  }
  if (new Set(ids).size !== ids.length) {
    return 'Duplicate provider_id in combo_payload.lines';
  }
  const placeholders = ids.map(() => '?').join(',');
  const rows = await executeSQL(
    `SELECT id FROM providers WHERE id IN (${placeholders})`,
    ids
  );
  const list = Array.isArray(rows) ? rows : [];
  if (list.length !== ids.length) {
    return 'One or more provider_id values in combo_payload do not exist';
  }
  return null;
}

/**
 * If is_combo and combo_payload is present with lines, run structured validation.
 * Legacy text-only combo (marker in service_description, no payload) passes.
 * @returns {Promise<string|null>}
 */
async function validateComboForCreate(is_combo, combo_payload) {
  if (!is_combo) return null;
  if (combo_payload == null) return null;
  if (typeof combo_payload !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(combo_payload, 'lines')) return null;
  return validateComboPayloadStructured(combo_payload);
}

module.exports = {
  COMBO_MARKER,
  normalizeProviderId,
  deriveIsCombo,
  validateComboForCreate,
  validateComboPayloadStructured,
};
