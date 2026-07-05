const notificationService = require('../services/notificationService');

module.exports = {
  getAll: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { limit, unread_only } = req.query;
      const rows = await notificationService.listForUser(userId, {
        limit,
        unreadOnly: unread_only === '1' || unread_only === 'true',
      });
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  unreadCount: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const count = await notificationService.countUnread(userId);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  markRead: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      await notificationService.markRead(req.params.id, userId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  markAllRead: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      await notificationService.markAllRead(userId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};
