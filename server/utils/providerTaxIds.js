/**
 * Tax identifiers required before a provider can become active on the platform.
 * BCE/KBO (`siret`) and VAT (`vat_number`) may be empty at signup, but activation
 * is blocked until both are present.
 */

function hasTaxValue(value) {
  return String(value || '').trim().length > 0;
}

/**
 * @param {{ siret?: string|null, vat_number?: string|null }} provider
 * @returns {{ ok: true } | { ok: false, code: string, missing: string[], error: string }}
 */
function assertProviderCanBeActivated(provider) {
  const missing = [];
  if (!hasTaxValue(provider?.vat_number)) missing.push('vat_number');
  if (!hasTaxValue(provider?.siret)) missing.push('siret');

  if (missing.length === 0) return { ok: true };

  const labels = missing.map((key) => (key === 'vat_number' ? 'TVA' : 'BCE/KBO'));
  return {
    ok: false,
    code: 'PROVIDER_TAX_IDS_REQUIRED',
    missing,
    error: `Le prestataire n'a pas encore de numéro de ${labels.join(' ni de ')}. Il ne peut pas être activé.`,
  };
}

module.exports = {
  hasTaxValue,
  assertProviderCanBeActivated,
};
