/**
 * Same token shape as Base44: btoa(offerId + clientEmail).substring(0, 16)
 * (ASCII-safe for typical emails.)
 */
function makeOfferActionToken(offerId, clientEmail) {
  const raw = String(offerId ?? '') + String(clientEmail ?? '');
  return Buffer.from(raw, 'utf8').toString('base64').substring(0, 16);
}

module.exports = { makeOfferActionToken };
