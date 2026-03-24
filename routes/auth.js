const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/me', authenticate, ctrl.me);
router.put('/change-password', authenticate, ctrl.changePassword);

router.get('/verify-email', ctrl.verifyEmail);
router.post('/resend-verification', ctrl.resendVerification);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);

module.exports = router;
