const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/escrowController');

// Client (or admin) confirms delivery → release funds.
router.post('/payments/:id/confirm-delivery', authenticate, ctrl.confirmDelivery);
// Client or provider opens a dispute → freeze funds.
router.post('/payments/:id/dispute', authenticate, ctrl.openDispute);
// Admin resolves a dispute → release or refund.
router.post('/payments/:id/resolve', authenticate, requireRole('admin'), ctrl.resolveDispute);
// Admin lists open disputes and held escrows.
router.get('/disputes', authenticate, requireRole('admin'), ctrl.listDisputes);

module.exports = router;
