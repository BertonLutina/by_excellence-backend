const express = require('express');
const router = express.Router();
const { getContactInfo, postContact } = require('../controllers/contactController');

router.get('/contact-info', getContactInfo);
router.post('/contact', postContact);

module.exports = router;
