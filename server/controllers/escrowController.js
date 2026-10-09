/**
 * Escrow endpoints (Roadmap Phase 2 wiring).
 *
 * These drive the pure escrow state machine (server/payments/escrow.js) over the
 * Payment row's `escrow_status` column. They are ADDITIVE: the existing payment
 * flow is untouched, and these routes stay inert until called. They require the
 * escrow columns — run: node server/scripts/add-escrow-columns.js
 *
 * Releasing escrow means the provider net is due and can be queued as an in-app
 * bank-transfer order. It does not move the Stripe balance.
 */
const Payment = require('../models/Payment');
const Dispute = require('../models/Dispute');
const { executeSQL } = require('../db/db');
const escrow = require('../payments/escrow');
const { isAdmin, isRequestClient, providerIdForUser } = require('../utils/entityAccess');

const DEFAULT_HOLD_DAYS = Number(process.env.ESCROW_HOLD_DAYS) || 3;

/** Mark a paid payment as held in escrow. Call this when a payment becomes paid. */
async function markHeld(paymentId, { holdDays = DEFAULT_HOLD_DAYS } = {}) {
  const id = Number(paymentId);
  if (!id) return null;
  const releaseAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000);
  await Payment.update(id, {
    escrow_status: escrow.ESCROW_STATUS.HELD,
    auto_release_at: releaseAt.toISOString().slice(0, 19).replace('T', ' '),
  });
  return { id, escrow_status: escrow.ESCROW_STATUS.HELD, auto_release_at: releaseAt };
}

async function isRequestProvider(requestId, userId) {
  const pid = await providerIdForUser(userId);
  if (pid == null) return false;
  const rows = await executeSQL('SELECT provider_id FROM service_requests WHERE id = ? LIMIT 1', [requestId]);
  const sr = Array.isArray(rows) ? rows[0] : rows;
  return sr != null && Number(sr.provider_id) === pid;
}

/** Funds stay on the platform. The net is due; an admin records the bank transfer separately. */
function settlementDue(payment) {
  return {
    paid_out: false,
    provider_net_due: true,
    amount: Number(payment?.provider_net_amount) || 0,
  };
}

async function applyAndSave(payment, event, extra = {}) {
  const next = escrow.apply(payment.escrow_status, event); // throws EscrowTransitionError (409)
  await Payment.update(payment.id, { escrow_status: next, ...extra });
  return next;
}

module.exports = {
  markHeld,

  // Client confirms the service was delivered → release funds to the provider.
  confirmDelivery: async (req, res) => {
    try {
      const payment = await Payment.findById(req.params.id);
      if (!payment) return res.status(404).json({ error: 'Payment not found' });

      const allowed = isAdmin(req.user) || (await isRequestClient(payment.request_id, req.user?.id));
      if (!allowed) return res.status(403).json({ error: 'Forbidden' });

      const next = await applyAndSave(payment, escrow.ESCROW_EVENT.CONFIRM_DELIVERY);
      return res.json({ escrow_status: next, ...settlementDue(payment) });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  },

  // Either party opens a dispute → funds freeze.
  openDispute: async (req, res) => {
    try {
      const payment = await Payment.findById(req.params.id);
      if (!payment) return res.status(404).json({ error: 'Payment not found' });

      const isClient = await isRequestClient(payment.request_id, req.user?.id);
      const isProvider = await isRequestProvider(payment.request_id, req.user?.id);
      if (!isAdmin(req.user) && !isClient && !isProvider) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const next = await applyAndSave(payment, escrow.ESCROW_EVENT.OPEN_DISPUTE);
      const dispute = await Dispute.create({
        payment_id: payment.id,
        request_id: payment.request_id,
        opened_by: req.user?.id,
        opened_by_role: isClient ? 'client' : isProvider ? 'provider' : 'admin',
        reason: String(req.body?.reason || '').slice(0, 2000),
        status: 'open',
      });
      return res.status(201).json({ escrow_status: next, dispute });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  },

  // Admin resolves a dispute → release to provider or refund the client.
  resolveDispute: async (req, res) => {
    try {
      const payment = await Payment.findById(req.params.id);
      if (!payment) return res.status(404).json({ error: 'Payment not found' });

      const resolution = String(req.body?.resolution || '').toLowerCase();
      const event =
        resolution === 'release' ? escrow.ESCROW_EVENT.RESOLVE_RELEASE :
        resolution === 'refund' ? escrow.ESCROW_EVENT.RESOLVE_REFUND : null;
      if (!event) return res.status(400).json({ error: "resolution must be 'release' or 'refund'" });

      const next = await applyAndSave(payment, event);

      // Close any open dispute for this payment.
      const open = await Dispute.findAll({ filters: { payment_id: payment.id, status: 'open' }, limit: 10 });
      for (const d of Array.isArray(open) ? open : []) {
        await Dispute.update(d.id, {
          status: 'resolved',
          resolution: resolution === 'release' ? 'released' : 'refunded',
          resolved_by: req.user?.id,
          resolved_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        });
      }

      const settlement = resolution === 'release' ? settlementDue(payment) : { paid_out: false, provider_net_due: false };
      return res.json({ escrow_status: next, resolution, ...settlement });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  },

  /** Admin: open disputes + payments still held in escrow. */
  listDisputes: async (req, res) => {
    try {
      const [openDisputes, heldPayments, disputedPayments] = await Promise.all([
        Dispute.findAll({ filters: { status: 'open' }, sort: 'created_at', order: 'DESC', limit: 200 }),
        Payment.findAll({ filters: { escrow_status: 'held' }, sort: 'created_at', order: 'DESC', limit: 200 }),
        Payment.findAll({ filters: { escrow_status: 'disputed' }, sort: 'created_at', order: 'DESC', limit: 200 }),
      ]);
      return res.json({
        disputes: Array.isArray(openDisputes) ? openDisputes : [],
        held: Array.isArray(heldPayments) ? heldPayments : [],
        disputed: Array.isArray(disputedPayments) ? disputedPayments : [],
      });
    } catch (err) {
      return res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
  },

  /** Job: release held payments whose auto_release_at has passed. Returns count. */
  runAutoRelease: async () => {
    const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const rows = await executeSQL(
      `SELECT * FROM payments WHERE escrow_status = 'held' AND auto_release_at IS NOT NULL AND auto_release_at <= ?`,
      [nowSql]
    );
    let released = 0;
    for (const p of Array.isArray(rows) ? rows : []) {
      try {
        await applyAndSave(p, escrow.ESCROW_EVENT.AUTO_RELEASE);
        released += 1;
      } catch (err) {
        console.warn(`[escrow] auto-release failed for payment ${p.id}:`, err.message);
      }
    }
    return { released };
  },
};
