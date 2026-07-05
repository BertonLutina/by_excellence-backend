/**
 * Public entry point for the payment-provider layer.
 *
 * Usage (from a controller):
 *   const payments = require('../payments');
 *   const gw = payments.getPaymentProvider({ method, currency, provider });
 *   const checkout = await gw.createCheckout({ amount, currency, reference, ... });
 *
 * The rest of the app should import from here, never from a specific adapter.
 */
const { getPaymentProvider, listProviders, byId, allAdapters } = require('./registry');
const { PAYMENT_STATUS, NotConfiguredError, PaymentProvider } = require('./PaymentProvider');
const money = require('./money');
const { paymentsConfig, isMobileMoneyConfigured } = require('./config');

module.exports = {
  getPaymentProvider,
  listProviders,
  byId,
  allAdapters,
  PAYMENT_STATUS,
  NotConfiguredError,
  PaymentProvider,
  money,
  paymentsConfig,
  isMobileMoneyConfigured,
};
