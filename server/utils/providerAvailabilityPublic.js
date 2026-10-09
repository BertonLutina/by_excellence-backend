function coerceAvailable(value, fallback = true) {
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  return fallback;
}

function normalizeProgramNote(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 280) : null;
}

function stripProgramNote(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  delete out.program_note;
  return out;
}

function sanitizeAvailabilityRow(row, { canSeeProgram } = {}) {
  if (!row) return row;
  return canSeeProgram ? row : stripProgramNote(row);
}

module.exports = {
  coerceAvailable,
  normalizeProgramNote,
  stripProgramNote,
  sanitizeAvailabilityRow,
};
