const User = require('../models/User');

exports.list = async (req, res) => {
  try {
    const { role, search } = req.query;
    const users = await User.findAll({ role, search });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { full_name, role } = req.body;
    const isSelf = req.user.id === req.params.id;
    const isAdmin = req.user.role === 'admin';
    if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Forbidden' });
    if (role && !isAdmin) return res.status(403).json({ error: 'Only admins can change roles' });
    const updated = await User.update(req.params.id, { full_name, role: isAdmin ? role : undefined });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    await User.delete(req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
