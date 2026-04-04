const express = require('express');
const ctrl = require('../controllers/stripeCheckoutElementsController');

const router = express.Router();

router.post('/create-checkout-session', ctrl.createCheckoutSession);
router.get('/session-status', ctrl.sessionStatus);

module.exports = router;
