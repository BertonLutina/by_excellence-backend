/**
 * Admin-only Stripe API bridge: maps HTTP routes to stripe-node SDK calls.
 * Mirrors common REST shapes from https://stripe.com/docs/api
 */

const { sendStripe } = require('../utils/stripeHttpError');

const B = (req) => req.body || {};

// --- payouts ---
exports.payoutsCreate = (req, res) => sendStripe(res, () => req.stripe.payouts.create(B(req)));
exports.payoutsUpdate = (req, res) =>
  sendStripe(res, () => req.stripe.payouts.update(req.params.id, B(req)));
exports.payoutsRetrieve = (req, res) =>
  sendStripe(res, () => req.stripe.payouts.retrieve(req.params.id, req.query));
exports.payoutsList = (req, res) => sendStripe(res, () => req.stripe.payouts.list(req.query));
exports.payoutsCancel = (req, res) =>
  sendStripe(res, () => req.stripe.payouts.cancel(req.params.id, B(req)));
exports.payoutsReverse = (req, res) =>
  sendStripe(res, () => req.stripe.payouts.reverse(req.params.id, B(req)));

// --- payment_methods ---
exports.paymentMethodsCreate = (req, res) =>
  sendStripe(res, () => req.stripe.paymentMethods.create(B(req)));
exports.paymentMethodsUpdate = (req, res) =>
  sendStripe(res, () => req.stripe.paymentMethods.update(req.params.id, B(req)));
exports.paymentMethodsRetrieve = (req, res) =>
  sendStripe(res, () => req.stripe.paymentMethods.retrieve(req.params.id, req.query));
exports.paymentMethodsList = (req, res) =>
  sendStripe(res, () => req.stripe.paymentMethods.list(req.query));
exports.paymentMethodsAttach = (req, res) =>
  sendStripe(res, () => req.stripe.paymentMethods.attach(req.params.id, B(req)));
exports.paymentMethodsDetach = (req, res) =>
  sendStripe(res, () => req.stripe.paymentMethods.detach(req.params.id, B(req)));
exports.customersPaymentMethodsRetrieve = (req, res) =>
  sendStripe(res, () =>
    req.stripe.paymentMethods.retrieve(req.params.paymentMethodId, req.query)
  );
exports.customersPaymentMethodsList = (req, res) =>
  sendStripe(res, () =>
    req.stripe.customers.listPaymentMethods(req.params.customerId, req.query)
  );

// --- payment_intents ---
exports.paymentIntentsCreate = (req, res) =>
  sendStripe(res, () => req.stripe.paymentIntents.create(B(req)));
exports.paymentIntentsUpdate = (req, res) =>
  sendStripe(res, () => req.stripe.paymentIntents.update(req.params.id, B(req)));
exports.paymentIntentsRetrieve = (req, res) =>
  sendStripe(res, () => req.stripe.paymentIntents.retrieve(req.params.id, req.query));
exports.paymentIntentsListAmountDetailsLineItems = (req, res) =>
  sendStripe(res, () =>
    req.stripe.paymentIntents.listAmountDetailsLineItems(req.params.id, req.query)
  );
exports.paymentIntentsList = (req, res) =>
  sendStripe(res, () => req.stripe.paymentIntents.list(req.query));
exports.paymentIntentsCancel = (req, res) =>
  sendStripe(res, () => req.stripe.paymentIntents.cancel(req.params.id, B(req)));
exports.paymentIntentsCapture = (req, res) =>
  sendStripe(res, () => req.stripe.paymentIntents.capture(req.params.id, B(req)));
exports.paymentIntentsConfirm = (req, res) =>
  sendStripe(res, () => req.stripe.paymentIntents.confirm(req.params.id, B(req)));
exports.paymentIntentsIncrementAuthorization = (req, res) =>
  sendStripe(res, () =>
    req.stripe.paymentIntents.incrementAuthorization(req.params.id, B(req))
  );
exports.paymentIntentsApplyCustomerBalance = (req, res) =>
  sendStripe(res, () =>
    req.stripe.paymentIntents.applyCustomerBalance(req.params.id, B(req))
  );
exports.paymentIntentsSearch = (req, res) =>
  sendStripe(res, () => req.stripe.paymentIntents.search(req.query));
exports.paymentIntentsVerifyMicrodeposits = (req, res) =>
  sendStripe(res, () =>
    req.stripe.paymentIntents.verifyMicrodeposits(req.params.id, B(req))
  );

// --- products ---
exports.productsCreate = (req, res) => sendStripe(res, () => req.stripe.products.create(B(req)));
exports.productsUpdate = (req, res) =>
  sendStripe(res, () => req.stripe.products.update(req.params.id, B(req)));
exports.productsRetrieve = (req, res) =>
  sendStripe(res, () => req.stripe.products.retrieve(req.params.id, req.query));
exports.productsList = (req, res) => sendStripe(res, () => req.stripe.products.list(req.query));
exports.productsDelete = (req, res) =>
  sendStripe(res, () => req.stripe.products.del(req.params.id, B(req)));
exports.productsSearch = (req, res) =>
  sendStripe(res, () => req.stripe.products.search(req.query));

// --- prices ---
exports.pricesCreate = (req, res) => sendStripe(res, () => req.stripe.prices.create(B(req)));
exports.pricesUpdate = (req, res) =>
  sendStripe(res, () => req.stripe.prices.update(req.params.id, B(req)));
exports.pricesRetrieve = (req, res) =>
  sendStripe(res, () => req.stripe.prices.retrieve(req.params.id, req.query));
exports.pricesList = (req, res) => sendStripe(res, () => req.stripe.prices.list(req.query));
exports.pricesSearch = (req, res) =>
  sendStripe(res, () => req.stripe.prices.search(req.query));

// --- checkout.sessions ---
exports.checkoutSessionsCreate = (req, res) =>
  sendStripe(res, () => req.stripe.checkout.sessions.create(B(req)));
exports.checkoutSessionsUpdate = (req, res) =>
  sendStripe(res, () => req.stripe.checkout.sessions.update(req.params.id, B(req)));
exports.checkoutSessionsRetrieve = (req, res) =>
  sendStripe(res, () => req.stripe.checkout.sessions.retrieve(req.params.id, req.query));
exports.checkoutSessionsListLineItems = (req, res) =>
  sendStripe(res, () =>
    req.stripe.checkout.sessions.listLineItems(req.params.id, req.query)
  );
exports.checkoutSessionsList = (req, res) =>
  sendStripe(res, () => req.stripe.checkout.sessions.list(req.query));
exports.checkoutSessionsExpire = (req, res) =>
  sendStripe(res, () => req.stripe.checkout.sessions.expire(req.params.id, B(req)));

// --- credit_notes ---
exports.creditNotesCreate = (req, res) =>
  sendStripe(res, () => req.stripe.creditNotes.create(B(req)));
exports.creditNotesUpdate = (req, res) =>
  sendStripe(res, () => req.stripe.creditNotes.update(req.params.id, B(req)));
exports.creditNotesRetrieve = (req, res) =>
  sendStripe(res, () => req.stripe.creditNotes.retrieve(req.params.id, req.query));
exports.creditNotesListPreviewLines = (req, res) =>
  sendStripe(res, () => req.stripe.creditNotes.listPreviewLineItems(req.query));
exports.creditNotesListLines = (req, res) =>
  sendStripe(res, () => req.stripe.creditNotes.listLineItems(req.params.id, req.query));
exports.creditNotesList = (req, res) =>
  sendStripe(res, () => req.stripe.creditNotes.list(req.query));
exports.creditNotesPreview = (req, res) =>
  sendStripe(res, () => req.stripe.creditNotes.preview(req.query));
exports.creditNotesVoid = (req, res) =>
  sendStripe(res, () => req.stripe.creditNotes.voidCreditNote(req.params.id, B(req)));

// --- invoices ---
exports.invoicesCreatePreview = (req, res) =>
  sendStripe(res, () => req.stripe.invoices.createPreview(B(req)));
exports.invoicesCreate = (req, res) =>
  sendStripe(res, () => req.stripe.invoices.create(B(req)));
exports.invoicesUpdate = (req, res) =>
  sendStripe(res, () => req.stripe.invoices.update(req.params.invoiceId, B(req)));
exports.invoicesRetrieve = (req, res) =>
  sendStripe(res, () => req.stripe.invoices.retrieve(req.params.invoiceId, req.query));
exports.invoicesList = (req, res) =>
  sendStripe(res, () => req.stripe.invoices.list(req.query));
exports.invoicesDelete = (req, res) =>
  sendStripe(res, () => req.stripe.invoices.del(req.params.invoiceId, B(req)));
exports.invoicesAttachPayment = (req, res) =>
  sendStripe(res, () =>
    req.stripe.invoices.attachPayment(req.params.invoiceId, B(req))
  );
exports.invoicesFinalize = (req, res) =>
  sendStripe(res, () =>
    req.stripe.invoices.finalizeInvoice(req.params.invoiceId, B(req))
  );
exports.invoicesMarkUncollectible = (req, res) =>
  sendStripe(res, () =>
    req.stripe.invoices.markUncollectible(req.params.invoiceId, B(req))
  );
exports.invoicesPay = (req, res) =>
  sendStripe(res, () => req.stripe.invoices.pay(req.params.invoiceId, B(req)));
exports.invoicesSearch = (req, res) =>
  sendStripe(res, () => req.stripe.invoices.search(req.query));
exports.invoicesSend = (req, res) =>
  sendStripe(res, () => req.stripe.invoices.sendInvoice(req.params.invoiceId, B(req)));
exports.invoicesVoid = (req, res) =>
  sendStripe(res, () => req.stripe.invoices.voidInvoice(req.params.invoiceId, B(req)));
exports.invoicesUpdateLineItem = (req, res) =>
  sendStripe(res, () =>
    req.stripe.invoices.updateLineItem(
      req.params.invoiceId,
      req.params.lineItemId,
      B(req)
    )
  );
exports.invoicesListLineItems = (req, res) =>
  sendStripe(res, () =>
    req.stripe.invoices.listLineItems(req.params.invoiceId, req.query)
  );
exports.invoicesAddLines = (req, res) =>
  sendStripe(res, () => req.stripe.invoices.addLines(req.params.invoiceId, B(req)));
exports.invoicesRemoveLines = (req, res) =>
  sendStripe(res, () => req.stripe.invoices.removeLines(req.params.invoiceId, B(req)));
exports.invoicesUpdateLines = (req, res) =>
  sendStripe(res, () => req.stripe.invoices.updateLines(req.params.invoiceId, B(req)));

// --- invoice_payments ---
exports.invoicePaymentsRetrieve = (req, res) =>
  sendStripe(res, () => req.stripe.invoicePayments.retrieve(req.params.id, req.query));
exports.invoicePaymentsList = (req, res) =>
  sendStripe(res, () => req.stripe.invoicePayments.list(req.query));

// --- subscriptions ---
exports.subscriptionsCreate = (req, res) =>
  sendStripe(res, () => req.stripe.subscriptions.create(B(req)));
exports.subscriptionsUpdate = (req, res) =>
  sendStripe(res, () => req.stripe.subscriptions.update(req.params.id, B(req)));
exports.subscriptionsRetrieve = (req, res) =>
  sendStripe(res, () => req.stripe.subscriptions.retrieve(req.params.id, req.query));
exports.subscriptionsList = (req, res) =>
  sendStripe(res, () => req.stripe.subscriptions.list(req.query));
exports.subscriptionsCancel = (req, res) =>
  sendStripe(res, () => req.stripe.subscriptions.cancel(req.params.id, B(req)));
exports.subscriptionsMigrate = (req, res) =>
  sendStripe(res, () => req.stripe.subscriptions.migrate(req.params.id, B(req)));
exports.subscriptionsResume = (req, res) =>
  sendStripe(res, () => req.stripe.subscriptions.resume(req.params.id, B(req)));
exports.subscriptionsSearch = (req, res) =>
  sendStripe(res, () => req.stripe.subscriptions.search(req.query));

// --- subscription_schedules ---
exports.subscriptionSchedulesCreate = (req, res) =>
  sendStripe(res, () => req.stripe.subscriptionSchedules.create(B(req)));
exports.subscriptionSchedulesUpdate = (req, res) =>
  sendStripe(res, () =>
    req.stripe.subscriptionSchedules.update(req.params.id, B(req))
  );
exports.subscriptionSchedulesRetrieve = (req, res) =>
  sendStripe(res, () =>
    req.stripe.subscriptionSchedules.retrieve(req.params.id, req.query)
  );
exports.subscriptionSchedulesList = (req, res) =>
  sendStripe(res, () => req.stripe.subscriptionSchedules.list(req.query));
exports.subscriptionSchedulesCancel = (req, res) =>
  sendStripe(res, () =>
    req.stripe.subscriptionSchedules.cancel(req.params.id, B(req))
  );
exports.subscriptionSchedulesRelease = (req, res) =>
  sendStripe(res, () =>
    req.stripe.subscriptionSchedules.release(req.params.id, B(req))
  );
