const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/serviceRequestController');

const router = express.Router();

router.get('/', authenticate, ctrl.getAll);
router.get('/:id', authenticate, ctrl.getOne);
router.post('/', optionalAuth, ctrl.create);
router.put('/:id', authenticate, ctrl.update);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;
