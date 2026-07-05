const router = require('express').Router();
const createEntityRouter = require('./createEntityRouter');
const ctrl = require('../controllers/providerController');
const { authenticate, requireRole } = require('../middleware/auth');

// Public discovery search — registered before the entity catch-all so "/search"
// isn't matched as "/:id".
router.get('/search', ctrl.search);

router.use('/', createEntityRouter(ctrl, { publicGet: true }));
router.put('/:id/status', authenticate, requireRole('admin'), ctrl.updateStatus);
router.put('/:id/verified', authenticate, requireRole('admin'), ctrl.updateVerified);

module.exports = router;
