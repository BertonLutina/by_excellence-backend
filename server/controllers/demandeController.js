const service = require('../services/demandeService');

function handleError(res, err) {
  if (err?.status) return res.status(err.status).json({ error: err.message });
  return res.status(500).json({ error: err.message || 'Internal server error' });
}

exports.create = async (req, res) => {
  try {
    const data = await service.createDemande(req.body, req.user);
    return res.status(201).json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.updateOwn = async (req, res) => {
  try {
    const data = await service.updateClientDemande(req.params.id, req.body, req.user);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.adminPatch = async (req, res) => {
  try {
    const data = await service.adminPatchDemande(req.params.id, req.body);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.adminReplaceProviders = async (req, res) => {
  try {
    const data = await service.adminReplaceProviders(req.params.id, req.body);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.adminAssignParts = async (req, res) => {
  try {
    const data = await service.adminAssignParts(req.params.id, req.body);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.adminForward = async (req, res) => {
  try {
    const data = await service.adminForwardDemande(req.params.id);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.adminStatus = async (req, res) => {
  try {
    const data = await service.adminUpdateStatus(req.params.id, req.body.status);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.providerList = async (req, res) => {
  try {
    const data = await service.getProviderDemandes(req.user);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.providerGetOne = async (req, res) => {
  try {
    const data = await service.getProviderDemandeById(req.params.id, req.user);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

exports.providerRespond = async (req, res) => {
  try {
    const data = await service.providerRespond(req.params.id, req.body, req.user);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};
