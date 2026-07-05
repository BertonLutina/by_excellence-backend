/**
 * Referral codes for growth loops (Roadmap Phase 7).
 *
 * Providers invite providers, clients invite clients. Each user gets a short,
 * shareable code (e.g. BYX-7F3K9Q). Pure helpers to generate, normalize and
 * validate codes; persistence + reward crediting is wired by the caller.
 */

const PREFIX = 'BYX';
const BODY_LEN = 6;
// No ambiguous characters (0/O, 1/I) so codes are easy to read/type/say aloud.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = new RegExp(`^${PREFIX}-[${ALPHABET}]{${BODY_LEN}}$`);

function randomBody(len = BODY_LEN, rng = Math.random) {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    s += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  }
  return s;
}

/** Generate a new referral code, e.g. "BYX-7F3K9Q". */
function generateReferralCode(rng = Math.random) {
  return `${PREFIX}-${randomBody(BODY_LEN, rng)}`;
}

/** Normalize user input: uppercase, strip spaces, tolerate a missing dash. */
function normalizeReferralCode(input) {
  let s = String(input || '').toUpperCase().replace(/\s+/g, '');
  if (!s) return '';
  if (!s.includes('-') && s.startsWith(PREFIX)) {
    s = `${PREFIX}-${s.slice(PREFIX.length)}`;
  }
  return s;
}

function isValidReferralCode(input) {
  return CODE_RE.test(normalizeReferralCode(input));
}

module.exports = {
  generateReferralCode,
  normalizeReferralCode,
  isValidReferralCode,
  PREFIX,
  ALPHABET,
  BODY_LEN,
};
