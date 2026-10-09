const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/stripeWebhookController');

router.post('/webhook', express.raw({ type: 'application/json' }), ctrl.handle);

module.exports = router;
