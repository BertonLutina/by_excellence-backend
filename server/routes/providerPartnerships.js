const express = require('express');
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/providerPartnershipController');

const router = express.Router();

router.get('/', authenticate, ctrl.list);
router.post('/', authenticate, requireRole('provider'), ctrl.create);
router.get('/:id', optionalAuth, ctrl.getOne);
router.put('/:id/respond', authenticate, requireRole('provider', 'admin'), ctrl.respond);
router.put('/:id', authenticate, requireRole('provider', 'admin'), ctrl.update);

module.exports = router;
