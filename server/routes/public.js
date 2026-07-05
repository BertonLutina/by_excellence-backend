const express = require('express');
const router = express.Router();
const { getContactInfo, postContact } = require('../controllers/contactController');
const { getPublicConfig } = require('../controllers/publicConfigController');

router.get('/contact-info', getContactInfo);
router.post('/contact', postContact);
router.get('/config', getPublicConfig);

module.exports = router;
