const { isAdmin, providerIdForUser } = require('../utils/entityAccess');
const {
  PartnershipError,
  decorate,
  publicView,
  getById,
  invite,
  respond,
  updateByLeadOrAdmin,
  listForProvider,
  listPublicForProvider,
  listAll,
  isParty,
} = require('../services/providerPartnershipService');
const {
  notifyPartnershipInvite,
  notifyPartnershipResponse,
} = require('../services/notificationService');

function handleError(res, err) {
  const status = err instanceof PartnershipError ? err.status : err.status || 400;
  if (status >= 500) return res.status(500).json({ error: err.message });
  return res.status(status).json({ error: err.message });
}

async function callerProviderId(req) {
  if (req.user?.role !== 'provider') return null;
  return providerIdForUser(req.user.id);
}

const list = async (req, res) => {
  try {
    if (isAdmin(req.user) && (req.query.all === '1' || req.query.all === 'true')) {
      const rows = await listAll({ status: req.query.status || undefined });
      return res.json(rows.map((row) => decorate(row)));
    }
    const pid = await callerProviderId(req);
    if (!pid && !isAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });
    if (isAdmin(req.user) && !pid) {
      const rows = await listAll({ status: req.query.status || undefined });
      return res.json(rows.map((row) => decorate(row)));
    }
    const rows = await listForProvider(pid);
    res.json(rows.map((row) => decorate(row)));
  } catch (err) {
    handleError(res, err);
  }
};

const listPublicForProviderHandler = async (req, res) => {
  try {
    const rows = await listPublicForProvider(req.params.id);
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
};

const getOne = async (req, res) => {
  try {
    const row = await getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });

    const pid = await callerProviderId(req);
    const party = pid && isParty(row, pid);
    if (isAdmin(req.user) || party) {
      return res.json(decorate(row));
    }
    if (row.is_public && row.status === 'accepted') {
      return res.json(publicView(row));
    }
    return res.status(403).json({ error: 'Forbidden' });
  } catch (err) {
    handleError(res, err);
  }
};

const create = async (req, res) => {
  try {
    const pid = await callerProviderId(req);
    if (!pid) return res.status(403).json({ error: 'Only a provider can invite a partner' });
    const row = await invite(pid, req.body && typeof req.body === 'object' ? req.body : {});
    notifyPartnershipInvite(row.id).catch((e) => {
      console.warn('[partnerships invite] notify failed:', e.message);
    });
    res.status(201).json(decorate(row));
  } catch (err) {
    handleError(res, err);
  }
};

const respondHandler = async (req, res) => {
  try {
    const pid = await callerProviderId(req);
    if (!pid && !isAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });
    const row = await getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const actingPid = isAdmin(req.user) ? Number(row.partner_provider_id) : pid;
    const updated = await respond(req.params.id, actingPid, req.body || {});
    notifyPartnershipResponse(updated.id, updated.status).catch((e) => {
      console.warn('[partnerships respond] notify failed:', e.message);
    });
    res.json(decorate(updated));
  } catch (err) {
    handleError(res, err);
  }
};

const update = async (req, res) => {
  try {
    const pid = await callerProviderId(req);
    if (!pid && !isAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });
    const updated = await updateByLeadOrAdmin(
      req.params.id,
      { callerProviderId: pid, isAdminUser: isAdmin(req.user) },
      req.body && typeof req.body === 'object' ? req.body : {}
    );
    res.json(decorate(updated));
  } catch (err) {
    handleError(res, err);
  }
};

module.exports = {
  list,
  listPublicForProvider: listPublicForProviderHandler,
  getOne,
  create,
  respond: respondHandler,
  update,
};
