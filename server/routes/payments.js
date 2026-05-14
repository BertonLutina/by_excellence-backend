const express = require('express');
const createEntityRouter = require('./createEntityRouter');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/paymentController');

const router = express.Router();
router.get('/overdue-finals', authenticate, requireRole('admin'), ctrl.getOverdueFinals);
router.use(createEntityRouter(ctrl));
module.exports = router;
