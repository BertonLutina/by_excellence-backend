const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.get('/', authenticate, ctrl.getAll);
router.get('/unread-count', authenticate, ctrl.unreadCount);
router.put('/read-all', authenticate, ctrl.markAllRead);
router.put('/:id/read', authenticate, ctrl.markRead);

module.exports = router;
