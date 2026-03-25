const router = require('express').Router();
const ctrl = require('../controllers/demandeController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, requireRole('provider'), ctrl.providerList);
router.get('/:id', authenticate, requireRole('provider'), ctrl.providerGetOne);
router.post('/:id/respond', authenticate, requireRole('provider'), ctrl.providerRespond);

module.exports = router;
