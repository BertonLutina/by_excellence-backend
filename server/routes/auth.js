const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const authRouteRateLimit = require('../middleware/authRouteRateLimit');

router.post('/register', authRouteRateLimit, ctrl.register);
router.post('/login', authRouteRateLimit, ctrl.login);
router.get('/me', authenticate, ctrl.me);
router.put('/email-notifications', authenticate, ctrl.updateEmailNotifications);
router.put('/in-app-notifications', authenticate, ctrl.updateInAppNotifications);
router.put('/profile', authenticate, ctrl.updateProfile);
router.put('/change-password', authenticate, ctrl.changePassword);

router.get('/verify-email', ctrl.verifyEmail);
router.post('/resend-verification', authRouteRateLimit, ctrl.resendVerification);
router.post('/forgot-password', authRouteRateLimit, ctrl.forgotPassword);
router.post('/reset-password', authRouteRateLimit, ctrl.resetPassword);

module.exports = router;
