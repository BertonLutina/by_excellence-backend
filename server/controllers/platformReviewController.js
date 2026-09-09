const createEntityController = require('./createEntityController');
const PlatformReview = require('../models/PlatformReview');
const { isAdmin } = require('../utils/entityAccess');

const base = createEntityController(PlatformReview, 'PlatformReview');

/** Object-level authorization (anti-IDOR): only the author (or an admin) may mutate a review. */
function assertAuthorOwnsRow(req, row) {
  if (!row) return false;
  if (isAdmin(req.user)) return true;
  const userId = req.user?.id != null ? Number(req.user.id) : null;
  if (!userId) return false;
  return row.author_user_id != null && Number(row.author_user_id) === userId;
}

const update = async (req, res) => {
  try {
    const existing = await PlatformReview.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!assertAuthorOwnsRow(req, existing)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const row = await PlatformReview.update(req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const existing = await PlatformReview.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!assertAuthorOwnsRow(req, existing)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await PlatformReview.delete(req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { ...base, update, remove };
