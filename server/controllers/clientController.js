const service = require('../services/adminPanelService');

function handleError(res, err) {
  if (err?.status) return res.status(err.status).json({ error: err.message });
  return res.status(500).json({ error: err.message || 'Internal server error' });
}

exports.list = async (req, res) => {
  try {
    const rows = await service.listClients(req.query);
    return res.json(rows);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getOne = async (req, res) => {
  try {
    const row = await service.getClientById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(row);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const row = await service.updateClientStatus(req.params.id, req.body?.status);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(row);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.listDemandes = async (req, res) => {
  try {
    const client = await service.getClientById(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    const rows = await service.getClientDemandes(req.params.id);
    return res.json(rows);
  } catch (err) {
    return handleError(res, err);
  }
};
