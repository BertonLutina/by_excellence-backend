/**
 * Public, non-sensitive platform configuration.
 * Exposes commission rates so the frontend never hardcodes them
 * (single source of truth: env vars read by server/utils/commission.js).
 */
const { standardPercent, premiumDefaultPercent } = require('../utils/commission');
const { PARTNERSHIP_SPLIT_PAYOUTS_ENABLED } = require('../../constants/constant');

function getPublicConfig(req, res) {
  res.json({
    commission: {
      standard_percent: standardPercent(),
      premium_default_percent: premiumDefaultPercent(),
    },
    partnerships: {
      split_payouts_enabled: Boolean(PARTNERSHIP_SPLIT_PAYOUTS_ENABLED),
    },
  });
}

module.exports = { getPublicConfig };
