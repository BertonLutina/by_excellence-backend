/**
 * Phone normalization to E.164 (Roadmap Phase 5).
 *
 * WhatsApp and SMS gateways require E.164 (`+<country><number>`, 8–15 digits).
 * Across African markets numbers are entered many ways: local with a leading 0,
 * with 00 international prefix, with spaces/dashes, or already with '+'. This pure
 * helper normalizes them, using a default dial code for local-format numbers.
 */

/** @param {string} raw @param {string} [defaultDialCode] e.g. '225' (Côte d'Ivoire) */
function toE164(raw, defaultDialCode = '') {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Keep a leading + then strip everything non-digit.
  const hasPlus = s.startsWith('+');
  let digits = s.replace(/[^\d]/g, '');
  if (!digits) return null;

  if (hasPlus) {
    // Already international.
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2); // 00<cc>... -> <cc>...
  } else if (digits.startsWith('0')) {
    // Local format: drop trunk 0, prepend default country code.
    const cc = String(defaultDialCode || '').replace(/[^\d]/g, '');
    if (!cc) return null;
    digits = cc + digits.replace(/^0+/, '');
  } else {
    // No plus, no leading 0: assume it already includes a country code only if a
    // default is set and it doesn't already start with it; otherwise prepend.
    const cc = String(defaultDialCode || '').replace(/[^\d]/g, '');
    if (cc && !digits.startsWith(cc)) digits = cc + digits;
  }

  const e164 = `+${digits}`;
  return isValidE164(e164) ? e164 : null;
}

/** True for a syntactically valid E.164 number. */
function isValidE164(value) {
  return /^\+[1-9]\d{7,14}$/.test(String(value || ''));
}

module.exports = { toE164, isValidE164 };
