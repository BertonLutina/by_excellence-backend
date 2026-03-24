const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/functionsController');

router.post('/invoke', authenticate, ctrl.invoke);

module.exports = router;
