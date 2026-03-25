const router = require('express').Router();
const ctrl = require('../controllers/demandeController');
const { authenticate, requireRole } = require('../middleware/auth');

router.patch('/:id', authenticate, requireRole('admin'), ctrl.adminPatch);
router.patch('/:id/providers', authenticate, requireRole('admin'), ctrl.adminReplaceProviders);
router.patch('/:id/assignments', authenticate, requireRole('admin'), ctrl.adminAssignParts);
router.post('/:id/forward', authenticate, requireRole('admin'), ctrl.adminForward);
router.patch('/:id/status', authenticate, requireRole('admin'), ctrl.adminStatus);

module.exports = router;
