const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, requireRole('admin'), ctrl.list);
router.put('/:id/status', authenticate, requireRole('admin'), ctrl.updateStatus);

module.exports = router;
