const router = require('express').Router();
const createEntityRouter = require('./createEntityRouter');
const ctrl = require('../controllers/providerController');
const stripeConnectCtrl = require('../controllers/stripeConnectController');
const { authenticate, requireRole } = require('../middleware/auth');
const requireStripeConfigured = require('../middleware/requireStripeConfigured');

// Public discovery search — registered before the entity catch-all so "/search"
// isn't matched as "/:id".
router.get('/search', ctrl.search);

router.use('/', createEntityRouter(ctrl, { publicGet: true }));
router.put('/:id/status', authenticate, requireRole('admin'), ctrl.updateStatus);
router.put('/:id/verified', authenticate, requireRole('admin'), ctrl.updateVerified);

// Stripe Connect onboarding ("recevoir mes paiements via Stripe"). Ownership
// (owner or admin) is enforced inside the controller since it needs the
// provider row first to know who owns it.
router.post('/:id/stripe-connect', authenticate, requireStripeConfigured, stripeConnectCtrl.startOnboarding);
router.get('/:id/stripe-connect', authenticate, requireStripeConfigured, stripeConnectCtrl.getStatus);

module.exports = router;
