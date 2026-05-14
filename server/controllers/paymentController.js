const createEntityController = require('./createEntityController');
const Payment = require('../models/Payment');
const paymentCommissionService = require('../services/paymentCommissionService');
const { getPaymentWindowStatus } = require('../utils/paymentWindow');
const ServiceRequest = require('../models/ServiceRequest');

const base = createEntityController(Payment, 'Payment');

const update = async (req, res) => {
  try {
    const existing = await Payment.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const body = { ...req.body };
    const becomingPaid = body.status === 'paid' && existing.status !== 'paid';

    if (becomingPaid) {
      const commissionFields = await paymentCommissionService.commissionFieldsForPaidTransition(existing);
      Object.assign(body, commissionFields);
      if (body.paid_date == null) body.paid_date = new Date();
    }

    const row = await Payment.update(req.params.id, body);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getOverdueFinals = async (_req, res) => {
  try {
    const finals = await Payment.findAll({ filters: { type: 'final', status: 'pending' }, limit: 200 });
    const overdue = [];
    for (const p of finals) {
      const request = await ServiceRequest.findById(p.request_id);
      if (!request) continue;
      const eventDate = request.confirmed_date || request.preferred_date;
      const ws = getPaymentWindowStatus(eventDate ? new Date(eventDate) : null);
      if (ws.status === 'overdue') {
        overdue.push({ payment: p, request, windowStatus: ws });
      }
    }
    return res.json(overdue);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { ...base, update, getOverdueFinals };
