const MAX_DESC = 450;

function parseOfferItems(items) {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try {
      const v = JSON.parse(items);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isComboRequest(request) {
  if (!request) return false;
  return Boolean(request.is_combo === true || request.is_combo === 1 || request.is_combo === '1');
}

/**
 * Stripe Checkout product line — provider-specific amount comes from `payment.amount` elsewhere.
 */
function buildStripeProductName(payment, request, offer) {
  const comboTag = isComboRequest(request) ? 'Combo — ' : '';
  let paymentLabel = 'Solde';
  if (payment.type === 'deposit') paymentLabel = 'Acompte';
  else if (payment.type === 'installment')
    paymentLabel = `Tranche ${payment.installment_index}/${payment.installment_total}`;
  else if (payment.type === 'final') paymentLabel = 'Solde';

  const offerTitle = (offer && offer.title && String(offer.title).trim()) || '';
  const provider = request?.provider_name || 'Prestataire';
  const head = offerTitle ? `${comboTag}${paymentLabel} — ${offerTitle}` : `${comboTag}${paymentLabel} — ${provider}`;
  return head.length > 250 ? `${head.slice(0, 247)}…` : head;
}

function buildStripeProductDescription(payment, request, offer) {
  const parts = [];

  if (isComboRequest(request)) {
    parts.push('Demande combo (plusieurs prestations / prestataires).');
  }

  if (offer?.description) {
    parts.push(String(offer.description).trim());
  }

  const items = offer ? parseOfferItems(offer.items) : [];
  if (items.length > 0) {
    const lines = items.slice(0, 6).map((it) => {
      const label = it.label || 'Ligne';
      const price = it.price != null ? `${Number(it.price).toFixed(2)} €` : '';
      return price ? `${label} (${price})` : label;
    });
    parts.push(`Détail : ${lines.join(' · ')}`);
    if (items.length > 6) parts.push('…');
  }

  if (payment.type === 'installment') {
    parts.push(
      `Paiement échelonné : tranche ${payment.installment_index} sur ${payment.installment_total}.`
    );
  }

  const fromRequest = (request?.service_description || '').trim();
  if (fromRequest) {
    parts.push(fromRequest);
  }

  let out = parts.filter(Boolean).join('\n');
  if (out.length > MAX_DESC) out = `${out.slice(0, MAX_DESC - 1)}…`;
  return out;
}

module.exports = {
  buildStripeProductName,
  buildStripeProductDescription,
  isComboRequest,
  parseOfferItems,
};
