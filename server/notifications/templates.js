/**
 * Outbound message templates (French, plain text — suitable for SMS + WhatsApp).
 *
 * Real WhatsApp production traffic must use pre-approved templates on the provider
 * side; these strings are the content those templates render. Keep them short so
 * they fit one SMS segment where possible.
 *
 * Usage: render('booking_confirmed', { name, ref }) -> string
 * Missing params render as an empty string rather than "undefined".
 */

const TEMPLATES = {
  booking_confirmed:
    'By Excellence : bonjour {name}, votre réservation {ref} est confirmée. Détails : {url}',
  offer_available:
    'By Excellence : une offre est disponible pour votre demande {ref}. Voir : {url}',
  provider_on_the_way:
    'By Excellence : votre prestataire pour {ref} est en route. Suivi : {url}',
  payment_received:
    'By Excellence : paiement reçu pour {ref} ({amount}). Merci !',
  reminder:
    'By Excellence : rappel — {subject} pour {ref}. {url}',
  dispute_opened:
    'By Excellence : un litige a été ouvert sur {ref}. Notre équipe intervient. {url}',
};

function render(templateName, params = {}) {
  const tpl = TEMPLATES[templateName];
  if (!tpl) throw new Error(`Unknown notification template: ${templateName}`);
  return tpl.replace(/\{(\w+)\}/g, (_, key) => {
    const v = params[key];
    return v == null ? '' : String(v);
  }).replace(/\s+/g, ' ').trim();
}

module.exports = { render, TEMPLATES };
