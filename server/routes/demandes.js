const router = require('express').Router();
const ctrl = require('../controllers/demandeController');
const { authenticate, requireRole } = require('../middleware/auth');

router.post('/', authenticate, requireRole('client'), ctrl.create);
router.patch('/:id', authenticate, requireRole('client'), ctrl.updateOwn);

module.exports = router;
