const ALLOWED_PROVIDER_TIERS = new Set(['standard', 'premium']);

function normalizePriceFrom(priceFrom) {
  if (priceFrom === null || priceFrom === undefined || priceFrom === '') return null;
  const numeric = Number(priceFrom);
  return Number.isFinite(numeric) ? numeric : null;
}

function computeProviderTier(priceFrom) {
  const numericPrice = normalizePriceFrom(priceFrom);
  if (numericPrice === null) return null;
  return numericPrice > 1000 ? 'premium' : 'standard';
}

function isValidProviderTier(value) {
  return ALLOWED_PROVIDER_TIERS.has(value);
}

module.exports = {
  ALLOWED_PROVIDER_TIERS,
  computeProviderTier,
  isValidProviderTier,
  normalizePriceFrom,
};
