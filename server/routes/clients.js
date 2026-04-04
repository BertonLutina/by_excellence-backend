const router = require('express').Router();
const ctrl = require('../controllers/clientController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, requireRole('admin'), ctrl.list);
router.get('/:id', authenticate, requireRole('admin'), ctrl.getOne);
router.put('/:id/status', authenticate, requireRole('admin'), ctrl.updateStatus);
router.get('/:id/demandes', authenticate, requireRole('admin'), ctrl.listDemandes);

module.exports = router;
