/**
 * Stripe REST-style admin API. Base: /api/stripe-admin/v1
 * Requires JWT with role `admin` + STRIPE_SECRET_KEY configured.
 */
const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const requireStripeConfigured = require('../middleware/requireStripeConfigured');
const ctrl = require('../controllers/stripePlatformController');

const router = express.Router();

const chain = [authenticate, requireRole('admin'), requireStripeConfigured];

// --- payment_methods ---
router.post('/payment_methods/:id/detach', chain, ctrl.paymentMethodsDetach);
router.post('/payment_methods/:id/attach', chain, ctrl.paymentMethodsAttach);
router.post('/payment_methods/:id', chain, ctrl.paymentMethodsUpdate);
router.post('/payment_methods', chain, ctrl.paymentMethodsCreate);
router.get('/customers/:customerId/payment_methods/:paymentMethodId', chain, ctrl.customersPaymentMethodsRetrieve);
router.get('/customers/:customerId/payment_methods', chain, ctrl.customersPaymentMethodsList);
router.get('/payment_methods/:id', chain, ctrl.paymentMethodsRetrieve);
router.get('/payment_methods', chain, ctrl.paymentMethodsList);

// --- payment_intents ---
router.post('/payment_intents/:id/verify_microdeposits', chain, ctrl.paymentIntentsVerifyMicrodeposits);
router.post('/payment_intents/:id/increment_authorization', chain, ctrl.paymentIntentsIncrementAuthorization);
router.post('/payment_intents/:id/apply_customer_balance', chain, ctrl.paymentIntentsApplyCustomerBalance);
router.post('/payment_intents/:id/confirm', chain, ctrl.paymentIntentsConfirm);
router.post('/payment_intents/:id/capture', chain, ctrl.paymentIntentsCapture);
router.post('/payment_intents/:id/cancel', chain, ctrl.paymentIntentsCancel);
router.get('/payment_intents/:id/amount_details_line_items', chain, ctrl.paymentIntentsListAmountDetailsLineItems);
router.post('/payment_intents/:id', chain, ctrl.paymentIntentsUpdate);
router.get('/payment_intents/search', chain, ctrl.paymentIntentsSearch);
router.get('/payment_intents/:id', chain, ctrl.paymentIntentsRetrieve);
router.get('/payment_intents', chain, ctrl.paymentIntentsList);
router.post('/payment_intents', chain, ctrl.paymentIntentsCreate);

// --- products ---
router.get('/products/search', chain, ctrl.productsSearch);
router.delete('/products/:id', chain, ctrl.productsDelete);
router.post('/products/:id', chain, ctrl.productsUpdate);
router.get('/products/:id', chain, ctrl.productsRetrieve);
router.get('/products', chain, ctrl.productsList);
router.post('/products', chain, ctrl.productsCreate);

// --- prices ---
router.get('/prices/search', chain, ctrl.pricesSearch);
router.post('/prices/:id', chain, ctrl.pricesUpdate);
router.get('/prices/:id', chain, ctrl.pricesRetrieve);
router.get('/prices', chain, ctrl.pricesList);
router.post('/prices', chain, ctrl.pricesCreate);

// --- checkout.sessions ---
router.get('/checkout/sessions/:id/line_items', chain, ctrl.checkoutSessionsListLineItems);
router.post('/checkout/sessions/:id/expire', chain, ctrl.checkoutSessionsExpire);
router.post('/checkout/sessions/:id', chain, ctrl.checkoutSessionsUpdate);
router.get('/checkout/sessions/:id', chain, ctrl.checkoutSessionsRetrieve);
router.get('/checkout/sessions', chain, ctrl.checkoutSessionsList);
router.post('/checkout/sessions', chain, ctrl.checkoutSessionsCreate);

// --- credit_notes (preview paths before :id) ---
router.get('/credit_notes/preview/lines', chain, ctrl.creditNotesListPreviewLines);
router.get('/credit_notes/preview', chain, ctrl.creditNotesPreview);
router.get('/credit_notes/:id/lines', chain, ctrl.creditNotesListLines);
router.post('/credit_notes/:id/void', chain, ctrl.creditNotesVoid);
router.post('/credit_notes/:id', chain, ctrl.creditNotesUpdate);
router.get('/credit_notes/:id', chain, ctrl.creditNotesRetrieve);
router.get('/credit_notes', chain, ctrl.creditNotesList);
router.post('/credit_notes', chain, ctrl.creditNotesCreate);

// --- invoices (nested + search before :invoiceId) ---
router.post('/invoices/create_preview', chain, ctrl.invoicesCreatePreview);
router.get('/invoices/search', chain, ctrl.invoicesSearch);
router.post('/invoices/:invoiceId/lines/:lineItemId', chain, ctrl.invoicesUpdateLineItem);
router.get('/invoices/:invoiceId/lines', chain, ctrl.invoicesListLineItems);
router.post('/invoices/:invoiceId/add_lines', chain, ctrl.invoicesAddLines);
router.post('/invoices/:invoiceId/remove_lines', chain, ctrl.invoicesRemoveLines);
router.post('/invoices/:invoiceId/update_lines', chain, ctrl.invoicesUpdateLines);
router.post('/invoices/:invoiceId/attach_payment', chain, ctrl.invoicesAttachPayment);
router.post('/invoices/:invoiceId/finalize', chain, ctrl.invoicesFinalize);
router.post('/invoices/:invoiceId/mark_uncollectible', chain, ctrl.invoicesMarkUncollectible);
router.post('/invoices/:invoiceId/pay', chain, ctrl.invoicesPay);
router.post('/invoices/:invoiceId/send', chain, ctrl.invoicesSend);
router.post('/invoices/:invoiceId/void', chain, ctrl.invoicesVoid);
router.delete('/invoices/:invoiceId', chain, ctrl.invoicesDelete);
router.post('/invoices/:invoiceId', chain, ctrl.invoicesUpdate);
router.get('/invoices/:invoiceId', chain, ctrl.invoicesRetrieve);
router.get('/invoices', chain, ctrl.invoicesList);
router.post('/invoices', chain, ctrl.invoicesCreate);

// --- invoice_payments ---
router.get('/invoice_payments/:id', chain, ctrl.invoicePaymentsRetrieve);
router.get('/invoice_payments', chain, ctrl.invoicePaymentsList);

// --- subscriptions ---
router.post('/subscriptions/:id/migrate', chain, ctrl.subscriptionsMigrate);
router.post('/subscriptions/:id/resume', chain, ctrl.subscriptionsResume);
router.delete('/subscriptions/:id', chain, ctrl.subscriptionsCancel);
router.post('/subscriptions/:id', chain, ctrl.subscriptionsUpdate);
router.get('/subscriptions/search', chain, ctrl.subscriptionsSearch);
router.get('/subscriptions/:id', chain, ctrl.subscriptionsRetrieve);
router.get('/subscriptions', chain, ctrl.subscriptionsList);
router.post('/subscriptions', chain, ctrl.subscriptionsCreate);

// --- subscription_schedules ---
router.post('/subscription_schedules/:id/cancel', chain, ctrl.subscriptionSchedulesCancel);
router.post('/subscription_schedules/:id/release', chain, ctrl.subscriptionSchedulesRelease);
router.post('/subscription_schedules/:id', chain, ctrl.subscriptionSchedulesUpdate);
router.get('/subscription_schedules/:id', chain, ctrl.subscriptionSchedulesRetrieve);
router.get('/subscription_schedules', chain, ctrl.subscriptionSchedulesList);
router.post('/subscription_schedules', chain, ctrl.subscriptionSchedulesCreate);

module.exports = router;
