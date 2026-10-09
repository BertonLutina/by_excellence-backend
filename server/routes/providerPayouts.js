const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/providerPayoutController');

const admin = [authenticate, requireRole('admin')];

router.get('/queue', admin, ctrl.queue);
router.get('/', admin, ctrl.list);
router.post('/', admin, ctrl.create);
router.post('/:id/paid', admin, ctrl.markPaid);

module.exports = router;
