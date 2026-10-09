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
    // Object-level authorization (anti-IDOR): this endpoint had no ownership
    // check, so any authenticated account could read any user's profile.
    const isSelf = String(req.user?.id) === String(req.params.id);
    if (!isSelf && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
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

const ROLE_BY_ID = { 1: 'client', 2: 'provider', 3: 'admin' };
const DELETABLE_ROLES = new Set(['client', 'provider']);

function roleName(row) {
  const raw = row?.role;
  if (raw === 'client' || raw === 'provider' || raw === 'admin') return raw;
  return ROLE_BY_ID[Number(raw)] || null;
}

exports.remove = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const targetRole = roleName(target);
    if (!DELETABLE_ROLES.has(targetRole)) {
      return res.status(403).json({ error: 'Only client and provider accounts can be deleted' });
    }

    const isSelf = String(req.user?.id) === String(target.id);
    const isAdmin = req.user?.role === 'admin';
    if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    await User.delete(target.id);
    res.json({ success: true, id: target.id });
  } catch (err) {
    if (err?.code === 'ER_ROW_IS_REFERENCED_2' || err?.errno === 1451) {
      return res.status(409).json({ error: 'Account cannot be deleted while related records still reference it' });
    }
    res.status(500).json({ error: err.message });
  }
};
