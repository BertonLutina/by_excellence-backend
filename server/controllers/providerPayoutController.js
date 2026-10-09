/**
 * Admin bank-transfer orders for the provider net.
 * Client payments are collected on the By Excellence Stripe account.
 * This controller records that the net is due, then that the bank transfer
 * was sent. It does not call Stripe.
 */
const Payment = require('../models/Payment');
const Offer = require('../models/Offer');
const ServiceRequest = require('../models/ServiceRequest');
const ProviderPayout = require('../models/ProviderPayout');
const paymentCommissionService = require('../services/paymentCommissionService');
const { executeSQL } = require('../db/db');
const { providerIdForUser } = require('../utils/entityAccess');

const BLOCKED_ESCROW = {
  held: 'ESCROW_HELD',
  disputed: 'ESCROW_DISPUTED',
  refunded: 'ESCROW_REFUNDED',
};

function present(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    payment_id: Number(row.payment_id),
    provider_id: Number(row.provider_id),
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    created_by: row.created_by != null ? Number(row.created_by) : null,
    created_at: row.created_at,
    paid_at: row.paid_at || null,
    paid_by: row.paid_by != null ? Number(row.paid_by) : null,
    bank_reference: row.bank_reference || null,
  };
}

function isDuplicate(err) {
  return err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062;
}

function requireUserId(req, res) {
  const id = req.user?.id;
  if (id == null || id === '') {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return null;
  }
  return id;
}

function payoutBlock(payment) {
  if (payment.status === 'refunded' || String(payment.escrow_status || '') === 'refunded') {
    return { code: 'ESCROW_REFUNDED', error: 'Payment was refunded' };
  }
  if (payment.status !== 'paid') {
    return { code: 'PAYMENT_NOT_PAID', error: 'Payment is not paid' };
  }
  const escrowStatus = payment.escrow_status ? String(payment.escrow_status) : '';
  if (escrowStatus && escrowStatus !== 'released') {
    return {
      code: BLOCKED_ESCROW[escrowStatus] || 'ESCROW_BLOCKED',
      error: 'Escrow does not allow a payout yet',
    };
  }
  return null;
}

function normalizeReference(raw) {
  const ref = String(raw ?? '').trim();
  if (!ref || ref.length > 140) return null;
  return ref;
}

function money(value) {
  if (value == null || value === '') return null;
  const n = Math.round(Number(value) * 100) / 100;
  return Number.isFinite(n) ? n : null;
}

async function resolveAmount(payment) {
  const stored = money(payment.provider_net_amount);
  if (stored != null) return stored;
  const breakdown = await paymentCommissionService.computeBreakdownForPayment(payment);
  return money(breakdown.provider_net_amount);
}

async function loadOffer(payment) {
  if (!payment?.offer_id) return null;
  return Offer.findById(payment.offer_id);
}

async function resolveProviderId(payment, offer) {
  if (offer?.provider_id) return Number(offer.provider_id);
  if (payment.request_id) {
    const request = await ServiceRequest.findById(payment.request_id);
    if (request?.provider_id) return Number(request.provider_id);
  }
  return null;
}

const QUEUE_SELECT = `
  SELECT
    p.id AS payment_id,
    p.request_id,
    p.offer_id,
    p.type AS payment_type,
    p.amount,
    p.provider_net_amount,
    p.admin_commission_amount,
    p.stripe_fee_amount,
    p.payment_method,
    p.status AS payment_status,
    ESCROW_COL,
    o.partnership_id,
    COALESCE(o.provider_id, sr.provider_id) AS provider_id,
    pr.display_name AS provider_name,
    pp.id AS payout_id,
    pp.status AS payout_status,
    pp.amount AS payout_amount,
    pp.currency AS payout_currency,
    pp.bank_reference
  FROM payments p
  LEFT JOIN offers o ON o.id = p.offer_id
  LEFT JOIN service_requests sr ON sr.id = p.request_id
  LEFT JOIN providers pr ON pr.id = COALESCE(o.provider_id, sr.provider_id)
  LEFT JOIN provider_payouts pp ON pp.payment_id = p.id
  WHERE p.status = 'paid'
    AND (pp.id IS NULL OR pp.status = 'to_pay')
  ORDER BY p.paid_date DESC
  LIMIT 200
`;

async function loadQueueRows() {
  const withEscrow = QUEUE_SELECT.replace('ESCROW_COL', 'p.escrow_status');
  try {
    return await executeSQL(withEscrow);
  } catch (err) {
    if (!String(err.message || '').includes('escrow_status')) throw err;
    return executeSQL(QUEUE_SELECT.replace('ESCROW_COL', 'NULL AS escrow_status'));
  }
}

function queueItem(row) {
  const escrow = row.escrow_status ? String(row.escrow_status) : '';
  const blocked = escrow === 'held' || escrow === 'disputed' || escrow === 'refunded';
  return {
    payment_id: Number(row.payment_id),
    request_id: Number(row.request_id),
    provider_id: row.provider_id != null ? Number(row.provider_id) : null,
    provider_name: row.provider_name || null,
    payment_type: row.payment_type,
    amount: money(row.amount),
    provider_net_amount: money(row.provider_net_amount),
    admin_commission_amount: money(row.admin_commission_amount),
    stripe_fee_amount: row.payment_method === 'cash' ? 0 : money(row.stripe_fee_amount),
    escrow_status: escrow || null,
    partnership_id: row.partnership_id != null ? Number(row.partnership_id) : null,
    payout_blocked: blocked ? (BLOCKED_ESCROW[escrow] || 'ESCROW_BLOCKED') : (row.partnership_id ? 'PARTNERSHIP_PAYOUT_UNSUPPORTED' : null),
    payout: row.payout_id
      ? {
          id: Number(row.payout_id),
          status: row.payout_status,
          amount: money(row.payout_amount),
          currency: row.payout_currency,
          bank_reference: row.bank_reference || null,
        }
      : null,
    _skip: blocked,
  };
}

/** GET /api/admin/provider-payouts/queue */
exports.queue = async (req, res) => {
  try {
    const rows = await loadQueueRows();
    const list = (Array.isArray(rows) ? rows : []).map(queueItem).filter((item) => !item._skip);
    list.forEach((item) => { delete item._skip; });
    return res.json({ items: list });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** GET /api/provider/payouts — read-only status for the signed-in provider. */
exports.mine = async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (userId == null) return;
    const providerId = await providerIdForUser(userId);
    if (!providerId) return res.json({ items: [] });

    const sql = `
      SELECT
        p.id AS payment_id,
        p.request_id,
        p.type AS payment_type,
        p.provider_net_amount,
        p.escrow_status,
        pp.status AS payout_status,
        pp.amount AS payout_amount,
        pp.currency
      FROM payments p
      LEFT JOIN offers o ON o.id = p.offer_id
      LEFT JOIN service_requests sr ON sr.id = p.request_id
      LEFT JOIN provider_payouts pp ON pp.payment_id = p.id
      WHERE p.status = 'paid'
        AND COALESCE(o.provider_id, sr.provider_id) = ?
      ORDER BY p.paid_date DESC
      LIMIT 100
    `;
    let rows;
    try {
      rows = await executeSQL(sql, [providerId]);
    } catch (err) {
      if (!String(err.message || '').includes('escrow_status')) throw err;
      rows = await executeSQL(sql.replace('p.escrow_status,', 'NULL AS escrow_status,'), [providerId]);
    }
    const items = (Array.isArray(rows) ? rows : []).map((row) => {
      let phase = 'not_due';
      if (row.payout_status === 'paid') phase = 'paid';
      else if (row.payout_status === 'to_pay') phase = 'to_pay';
      return {
        payment_id: Number(row.payment_id),
        request_id: Number(row.request_id),
        payment_type: row.payment_type,
        amount: money(row.payout_amount != null ? row.payout_amount : row.provider_net_amount),
        currency: row.currency || 'EUR',
        phase,
      };
    });
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** GET /api/admin/provider-payouts?payment_id= | ?request_id= */
exports.list = async (req, res) => {
  try {
    const paymentId = req.query.payment_id;
    const requestId = req.query.request_id;
    if (paymentId != null && paymentId !== '') {
      const row = await ProviderPayout.findByPaymentId(paymentId);
      return res.json({ payouts: row ? [present(row)] : [] });
    }
    if (requestId != null && requestId !== '') {
      const rows = await executeSQL(
        `SELECT pp.* FROM provider_payouts pp
         INNER JOIN payments p ON p.id = pp.payment_id
         WHERE p.request_id = ?
         ORDER BY pp.created_at DESC
         LIMIT 100`,
        [requestId]
      );
      const list = Array.isArray(rows) ? rows : [];
      return res.json({ payouts: list.map(present) });
    }
    return res.status(400).json({ error: 'payment_id or request_id required', code: 'FILTER_REQUIRED' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/provider-payouts { payment_id }
 * One open or paid order per payment. A second call returns the existing row.
 */
exports.create = async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (userId == null) return;

    const paymentId = Number(req.body?.payment_id);
    if (!paymentId) {
      return res.status(400).json({ error: 'payment_id required', code: 'PAYMENT_ID_REQUIRED' });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment not found', code: 'PAYMENT_NOT_FOUND' });

    const existing = await ProviderPayout.findByPaymentId(paymentId);
    if (existing) {
      return res.json({ payout: present(existing), created: false });
    }

    const block = payoutBlock(payment);
    if (block) return res.status(400).json(block);

    const offer = await loadOffer(payment);
    if (offer?.partnership_id) {
      return res.status(400).json({
        error: 'Partnership nets are not payable as a single transfer yet',
        code: 'PARTNERSHIP_PAYOUT_UNSUPPORTED',
      });
    }

    const amount = await resolveAmount(payment);
    if (amount == null || amount <= 0) {
      return res.status(400).json({
        error: 'Provider net must be greater than zero',
        code: 'PAYOUT_AMOUNT_INVALID',
      });
    }

    const providerId = await resolveProviderId(payment, offer);
    if (!providerId) {
      return res.status(400).json({ error: 'Provider not found for this payment', code: 'PROVIDER_MISSING' });
    }

    try {
      const row = await ProviderPayout.create({
        payment_id: paymentId,
        provider_id: providerId,
        amount,
        currency: 'EUR',
        status: 'to_pay',
        created_by: userId,
        paid_at: null,
        paid_by: null,
        bank_reference: null,
      });
      return res.status(201).json({ payout: present(row), created: true });
    } catch (err) {
      if (isDuplicate(err)) {
        const again = await ProviderPayout.findByPaymentId(paymentId);
        if (again) return res.json({ payout: present(again), created: false });
      }
      throw err;
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** POST /api/admin/provider-payouts/:id/paid — admin confirms the bank transfer left. */
exports.markPaid = async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (userId == null) return;

    const row = await ProviderPayout.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Payout not found', code: 'PAYOUT_NOT_FOUND' });
    if (row.status === 'paid') {
      return res.json({ payout: present(row) });
    }

    const payment = await Payment.findById(row.payment_id);
    if (!payment) return res.status(404).json({ error: 'Payment not found', code: 'PAYMENT_NOT_FOUND' });
    const block = payoutBlock(payment);
    if (block) return res.status(400).json(block);

    const bankReference = normalizeReference(req.body?.bank_reference);
    if (!bankReference) {
      return res.status(400).json({
        error: 'bank_reference is required',
        code: 'BANK_REFERENCE_REQUIRED',
      });
    }

    const updated = await ProviderPayout.update(row.id, {
      status: 'paid',
      paid_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      paid_by: userId,
      bank_reference: bankReference,
    });
    return res.json({ payout: present(updated) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
