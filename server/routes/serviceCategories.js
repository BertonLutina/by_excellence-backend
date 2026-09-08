const router = require('express').Router();
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/serviceCategoryController');

router.get('/', optionalAuth, ctrl.getAll);
router.get('/:id', optionalAuth, ctrl.getOne);
router.post('/', authenticate, requireRole('admin'), ctrl.create);
router.put('/:id', authenticate, requireRole('admin'), ctrl.update);
router.delete('/:id', authenticate, requireRole('admin'), ctrl.remove);

module.exports = router;
