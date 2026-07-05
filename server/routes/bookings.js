const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/bookingController');

router.get('/', authenticate, ctrl.getAll);
router.get('/:id', authenticate, ctrl.getOne);
router.post('/', authenticate, ctrl.create);

// Lifecycle transitions (state machine enforces validity).
router.post('/:id/confirm', authenticate, ctrl.confirm);   // provider accepts
router.post('/:id/decline', authenticate, ctrl.decline);   // provider rejects
router.post('/:id/complete', authenticate, ctrl.complete); // service delivered
router.post('/:id/no-show', authenticate, ctrl.noShow);    // provider marks no-show
router.post('/:id/cancel', authenticate, ctrl.cancel);     // either party cancels

module.exports = router;
