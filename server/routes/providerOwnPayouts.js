const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/providerPayoutController');

router.get('/', authenticate, requireRole('provider'), ctrl.mine);

module.exports = router;
