const createEntityController = require('./createEntityController');
const Payment = require('../models/Payment');
const Offer = require('../models/Offer');
const { markPaymentPaid } = require('../services/paymentPostProcessService');
const { sendPaymentConfirmationEmail } = require('../services/paymentConfirmationEmail');
const { getPaymentWindowStatus } = require('../utils/paymentWindow');
const ServiceRequest = require('../models/ServiceRequest');
const { executeSQL } = require('../db/db');
const { isAdmin, providerIdForUser, isRequestClient } = require('../utils/entityAccess');

const base = createEntityController(Payment, 'Payment');

/** Filters a non-admin may pass to the list endpoint. */
const LIST_FILTERS = ['request_id', 'offer_id', 'type', 'status'];

/**
 * List payments scoped to the caller (anti-IDOR):
 *   admin    → unrestricted (base behavior)
 *   client   → only payments of their own service requests
 *   provider → only payments of requests assigned to their provider profile
 */
const getAll = async (req, res) => {
  try {
    if (isAdmin(req.user)) return base.getAll(req, res);

    const role = req.user?.role;
    const userId = req.user?.id != null ? Number(req.user.id) : null;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const conditions = [];
    const values = [];
    for (const key of LIST_FILTERS) {
      const v = req.query[key];
      if (v != null && v !== '') {
        conditions.push(`p.\`${key}\` = ?`);
        values.push(v);
      }
    }

    if (role === 'provider') {
      const pid = await providerIdForUser(userId);
      if (pid == null) return res.json([]);
      conditions.push('r.provider_id = ?');
      values.push(pid);
    } else {
      // client (and any other role): own requests only. Legacy-safe client_id match.
      conditions.push('(r.client_id = ? OR r.client_id IN (SELECT id FROM clients WHERE user_id = ?))');
      values.push(userId, userId);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const safeLimit = Number(req.query.limit) || 100;
    const safeOffset = Number(req.query.offset) || 0;
    const sql = `SELECT p.* FROM \`payments\` p
      JOIN \`service_requests\` r ON p.request_id = r.id
      ${where} ORDER BY p.\`created_at\` DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const rows = await executeSQL(sql, values);
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** True if the caller may read this payment. */
async function canReadPayment(user, payment) {
  if (isAdmin(user)) return true;
  const userId = user?.id != null ? Number(user.id) : null;
  if (!userId) return false;
  if (user.role === 'provider') {
    const pid = await providerIdForUser(userId);
    if (pid == null) return false;
    const sr = await ServiceRequest.findById(payment.request_id);
    return sr != null && Number(sr.provider_id) === pid;
  }
  return isRequestClient(payment.request_id, userId);
}

const getOne = async (req, res) => {
  try {
    const row = await Payment.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!(await canReadPayment(req.user, row))) return res.status(403).json({ error: 'Forbidden' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Create: admin unrestricted. A client may only create a *pending* payment on
 * their own request, with the amount taken from the accepted offer (never trusted
 * from the client).
 */
const create = async (req, res) => {
  try {
    if (isAdmin(req.user)) return base.create(req, res);

    const userId = req.user?.id != null ? Number(req.user.id) : null;
    const body = { ...(req.body || {}) };
    if (!userId || !(await isRequestClient(body.request_id, userId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Never trust client-supplied status/financial breakdown.
    body.status = 'pending';
    delete body.paid_date;
    delete body.commission_rate_percent;
    delete body.admin_commission_amount;
    delete body.provider_net_amount;

    // Clients may only create controlled payments tied to an offer of the
    // request; the amount is always recomputed server-side (never trusted).
    if (body.offer_id == null || !['deposit', 'final', 'goods_full'].includes(body.type)) {
      return res.status(400).json({ error: 'Clients can only create deposit, final or goods_full payments linked to an offer' });
    }
    const offer = await Offer.findById(body.offer_id);
    if (!offer || Number(offer.request_id) !== Number(body.request_id)) {
      return res.status(400).json({ error: 'offer_id does not match request_id' });
    }
    if (body.type === 'deposit') {
      if (offer.payment_flow === 'direct_full_payment') {
        return res.status(400).json({ error: 'Direct full payment offers do not use deposits' });
      }
      body.amount = Number(offer.deposit_amount || 0);
    } else if (body.type === 'final') {
      if (offer.payment_flow === 'direct_full_payment') {
        return res.status(400).json({ error: 'Direct full payment offers do not use final payments' });
      }
      body.amount = Math.round((Number(offer.total_amount || 0) - Number(offer.deposit_amount || 0)) * 100) / 100;
    } else {
      if (offer.payment_flow !== 'direct_full_payment') {
        return res.status(400).json({ error: 'goods_full payments require a direct full payment offer' });
      }
      if (offer.status !== 'accepted') {
        return res.status(400).json({ error: 'goods_full payments require an accepted offer' });
      }
      body.amount = Number(offer.total_amount || 0);

      const existing = await Payment.findAll({
        filters: { request_id: body.request_id, offer_id: body.offer_id, type: 'goods_full' },
        limit: 5,
      });
      if (existing.length > 0) {
        return res.status(200).json(existing[0]);
      }
    }

    const row = await Payment.create(body);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Status transitions (→ paid) go through markPaymentPaid + invoice email: admin only. */
const update = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });
    const existing = await Payment.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const body = { ...req.body };
    const becomingPaid = body.status === 'paid' && existing.status !== 'paid';

    if (becomingPaid) {
      const result = await markPaymentPaid(req.params.id, {
        payment_method: body.payment_method || 'cash',
        fromWebhook: false,
      });
      if (!result.ok) {
        return res.status(result.code || 400).json({ error: result.error || 'Payment update failed' });
      }
      sendPaymentConfirmationEmail(req.params.id).catch((e) =>
        console.error('[Payment.update] confirmation email:', e.message)
      );
      return res.json(result.payment);
    }

    const row = await Payment.update(req.params.id, body);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Forbidden' });
  return base.remove(req, res);
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

module.exports = { ...base, getAll, getOne, create, update, remove, getOverdueFinals };
