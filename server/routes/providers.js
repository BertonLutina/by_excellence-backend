const router = require('express').Router();
const createEntityRouter = require('./createEntityRouter');
const ctrl = require('../controllers/providerController');
const partnershipCtrl = require('../controllers/providerPartnershipController');
const { authenticate, requireRole } = require('../middleware/auth');

// Public discovery search — registered before the entity catch-all so "/search"
// isn't matched as "/:id".
router.get('/search', ctrl.search);
router.get('/:id/partnerships', partnershipCtrl.listPublicForProvider);

router.use('/', createEntityRouter(ctrl, { publicGet: true }));
router.put('/:id/status', authenticate, requireRole('admin'), ctrl.updateStatus);
router.put('/:id/verified', authenticate, requireRole('admin'), ctrl.updateVerified);
router.post('/:id/remind-vat', authenticate, requireRole('admin'), ctrl.remindVat);

module.exports = router;
