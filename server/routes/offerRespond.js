const router = require('express').Router();
const ctrl = require('../controllers/offerRespondController');

router.get('/respond', ctrl.get);

module.exports = router;
