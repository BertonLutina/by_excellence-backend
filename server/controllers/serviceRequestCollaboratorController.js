const { executeSQL } = require('../db/db');
const ServiceRequest = require('../models/ServiceRequest');
const {
  listCollaboratorsForRequest,
  getCollaborator,
  getLeadProviderId,
  inviteCollaborator,
  respondCollaborator,
  removeCollaborator,
} = require('../services/serviceRequestCollaborationService');
const {
  notifyCollaborationInvite,
  notifyCollaborationResponse,
} = require('../services/notificationService');

async function providerIdForUser(userId) {
  const rows = await executeSQL('SELECT id FROM providers WHERE user_id = ? LIMIT 1', [userId]);
  const r = Array.isArray(rows) ? rows[0] : rows;
  return r?.id ? Number(r.id) : null;
}

async function assertCanViewRequest(req, request) {
  if (!request) return false;
  if (req.user?.role === 'admin') return true;
  if (req.user?.role === 'client') {
    return Number(request.client_id) === Number(req.user.id);
  }
  if (req.user?.role === 'provider') {
    const pid = await providerIdForUser(req.user.id);
    if (!pid) return false;
    if (Number(request.provider_id) === pid) return true;
    const collab = await getCollaborator(request.id, pid);
    return Boolean(collab);
  }
  return false;
}

const invite = async (req, res) => {
  try {
    const requestId = req.params.id;
    const request = await ServiceRequest.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Not found' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const targetProviderId = Number(body.provider_id);
    if (!Number.isFinite(targetProviderId) || targetProviderId <= 0) {
      return res.status(400).json({ error: 'provider_id is required' });
    }

    let invitedBy = null;
    if (req.user?.role === 'admin') {
      invitedBy = await getLeadProviderId(requestId);
    } else if (req.user?.role === 'provider') {
      const pid = await providerIdForUser(req.user.id);
      const leadId = await getLeadProviderId(requestId);
      const isLead =
        (leadId && leadId === pid) || (!leadId && Number(request.provider_id) === pid);
      if (!isLead) return res.status(403).json({ error: 'Forbidden' });
      invitedBy = pid;
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const row = await inviteCollaborator(requestId, {
      providerId: targetProviderId,
      note: body.note != null ? String(body.note) : null,
      invitedByProviderId: invitedBy,
    });

    notifyCollaborationInvite(requestId, targetProviderId, invitedBy).catch((e) => {
      console.warn('[collaborators invite] notify failed:', e.message);
    });

    const collaborators = await listCollaboratorsForRequest(requestId);
    res.status(201).json({ collaborator: row, collaborators });
  } catch (err) {
    const status = err.message?.includes('already') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
};

const respond = async (req, res) => {
  try {
    const requestId = req.params.id;
    const providerId = Number(req.params.providerId);
    const request = await ServiceRequest.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Not found' });

    const status = String(req.body?.status || '').trim();
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'status must be accepted or declined' });
    }

    if (req.user?.role === 'admin') {
      // admin can respond on behalf
    } else if (req.user?.role === 'provider') {
      const pid = await providerIdForUser(req.user.id);
      if (pid !== providerId) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const row = await respondCollaborator(requestId, providerId, status);
    notifyCollaborationResponse(requestId, providerId, status).catch((e) => {
      console.warn('[collaborators respond] notify failed:', e.message);
    });

    const collaborators = await listCollaboratorsForRequest(requestId);
    res.json({ collaborator: row, collaborators });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const requestId = req.params.id;
    const providerId = Number(req.params.providerId);
    const request = await ServiceRequest.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Not found' });

    if (req.user?.role === 'admin') {
      // ok
    } else if (req.user?.role === 'provider') {
      const pid = await providerIdForUser(req.user.id);
      const leadId = await getLeadProviderId(requestId);
      const isLead =
        (leadId && leadId === pid) || (!leadId && Number(request.provider_id) === pid);
      if (!isLead) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await removeCollaborator(requestId, providerId);
    const collaborators = await listCollaboratorsForRequest(requestId);
    res.json({ success: true, collaborators });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const list = async (req, res) => {
  try {
    const request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Not found' });
    if (!(await assertCanViewRequest(req, request))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const collaborators = await listCollaboratorsForRequest(req.params.id);
    res.json(collaborators);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { invite, respond, remove, list, providerIdForUser, assertCanViewRequest };
