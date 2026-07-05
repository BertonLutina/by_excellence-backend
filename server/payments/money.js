/**
 * Currency-aware money helpers for multi-country payments.
 *
 * Payment gateways expect amounts in the currency's *minor units* (e.g. cents),
 * but the number of minor units per major unit varies by currency:
 *   - Most currencies have 2 decimals (USD, EUR, NGN, KES, GHS, ZAR, TZS...).
 *   - Several African + other currencies have 0 decimals (XOF, XAF, RWF, UGX...).
 *   - A few have 3 decimals (TND, KWD...).
 *
 * Getting this wrong means charging a client 100x too much (or too little), so
 * every adapter MUST convert through here rather than assuming cents.
 */

// Currencies with a number of decimals other than the default (2).
const DECIMALS_BY_CURRENCY = {
  // Zero-decimal
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, JPY: 0, KMF: 0, KRW: 0, MGA: 0,
  PYG: 0, RWF: 0, UGX: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  // Three-decimal
  BHD: 3, JOD: 3, KWD: 3, OMR: 3, TND: 3,
};

const DEFAULT_DECIMALS = 2;

function decimalsFor(currency) {
  const code = String(currency || '').toUpperCase();
  return Object.prototype.hasOwnProperty.call(DECIMALS_BY_CURRENCY, code)
    ? DECIMALS_BY_CURRENCY[code]
    : DEFAULT_DECIMALS;
}

/** Round a major-unit amount to the precision its currency allows. */
function roundMajor(amount, currency) {
  const d = decimalsFor(currency);
  const factor = Math.pow(10, d);
  return Math.round((Number(amount) || 0) * factor) / factor;
}

/**
 * Convert a major-unit amount (e.g. 1500.50) into integer minor units
 * for the given currency (e.g. 150050 for USD, 1500 for XOF).
 */
function toMinorUnits(amount, currency) {
  const d = decimalsFor(currency);
  const factor = Math.pow(10, d);
  return Math.round((Number(amount) || 0) * factor);
}

/** Convert integer minor units back to a major-unit number. */
function fromMinorUnits(minor, currency) {
  const d = decimalsFor(currency);
  const factor = Math.pow(10, d);
  return (Number(minor) || 0) / factor;
}

/** True if the gateway should receive integer amounts (zero-decimal currency). */
function isZeroDecimal(currency) {
  return decimalsFor(currency) === 0;
}

module.exports = {
  decimalsFor,
  roundMajor,
  toMinorUnits,
  fromMinorUnits,
  isZeroDecimal,
  DECIMALS_BY_CURRENCY,
  DEFAULT_DECIMALS,
};
