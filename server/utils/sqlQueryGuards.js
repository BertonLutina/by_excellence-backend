/**
 * Prevent SQL identifier injection in dynamic WHERE / ORDER BY.
 * Filter keys and sort columns must match /^[a-zA-Z_][a-zA-Z0-9_]*$/ and exist on the model.
 */

const MAX_IDENT_LEN = 64;
const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Frontend / legacy query uses `created_date` on tables that only expose `created_at`. */
const SORT_COLUMN_ALIASES = {
  created_date: 'created_at',
  created_at: 'created_date',
};

function isSafeSqlIdentifier(s) {
  return typeof s === 'string' && s.length > 0 && s.length <= MAX_IDENT_LEN && IDENT_RE.test(s);
}

/**
 * @param {Record<string, unknown>} filters
 * @param {string[]} allowedColumns - model column names
 * @returns {Record<string, unknown>}
 */
function sanitizeFilters(filters, allowedColumns) {
  const allow = new Set(allowedColumns || []);
  const out = {};
  for (const [k, v] of Object.entries(filters || {})) {
    if (v === undefined || v === null) continue;
    if (!isSafeSqlIdentifier(k) || !allow.has(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * @param {string} [sort] - e.g. "-created_at" or "name"
 * @param {string} [order] - used when sort has no leading "-"
 * @param {string[]} allowedColumns
 * @param {string[]} [preferredFallbacks]
 */
function resolveSortColumn(sort, order, allowedColumns, preferredFallbacks = ['created_at', 'created_date', 'id']) {
  const allow = new Set(allowedColumns || []);
  const sortDir =
    typeof sort === 'string' && sort.startsWith('-')
      ? 'DESC'
      : String(order || 'DESC').toUpperCase() === 'ASC'
        ? 'ASC'
        : 'DESC';

  let raw = typeof sort === 'string' && sort.startsWith('-') ? sort.slice(1) : sort;
  raw = typeof raw === 'string' ? raw.trim() : '';

  let col = raw;
  if (isSafeSqlIdentifier(col) && !allow.has(col) && SORT_COLUMN_ALIASES[col]) {
    const mapped = SORT_COLUMN_ALIASES[col];
    if (allow.has(mapped)) col = mapped;
  }

  if (isSafeSqlIdentifier(col) && allow.has(col)) {
    return { sortCol: col, sortDir };
  }

  for (const f of preferredFallbacks) {
    if (isSafeSqlIdentifier(f) && allow.has(f)) return { sortCol: f, sortDir };
  }

  const first = (allowedColumns || []).find((c) => isSafeSqlIdentifier(c));
  return { sortCol: first || 'id', sortDir };
}

module.exports = {
  isSafeSqlIdentifier,
  sanitizeFilters,
  resolveSortColumn,
  SORT_COLUMN_ALIASES,
};
