const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/stripeWebhookController');

router.post('/webhook', express.raw({ type: 'application/json' }), ctrl.handle);
// Separate destination/secret: Stripe's Connect ("Comptes connectés") event
// scope requires its own webhook destination distinct from "Votre compte" —
// they cannot share one signing secret. See stripeWebhookController.handleConnect.
router.post('/webhook/connect', express.raw({ type: 'application/json' }), ctrl.handleConnect);

module.exports = router;
