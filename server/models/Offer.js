/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');
const { bindJsonDocument } = require('../utils/portfolioImages');

const TABLE = 'offers';
const COLUMNS = [
  'id', 'request_id', 'provider_id', 'title', 'description', 'items', 'total_amount',
  'deposit_amount', 'deposit_percentage', 'commission_mode', 'payment_flow',
  'partnership_id', 'partnership_split',
  'conditions', 'valid_until', 'status', 'installment_requested',
  'installment_count', 'installment_status', 'created_at', 'updated_date',
];

const OFFER_STATUS_ALLOWED = new Set([
  'draft',
  'sent_to_admin',
  'sent_to_client',
  'accepted',
  'rejected',
  'expired',
]);

function normalizeOfferStatus(status) {
  if (status === undefined) return undefined;
  const s = String(status || '').trim();
  if (!s) return undefined;
  if (OFFER_STATUS_ALLOWED.has(s)) return s;
  // Backward compatibility for legacy frontend labels.
  if (s === 'draft_for_provider') return 'draft';
  if (s === 'sent') return 'sent_to_client';
  return 'draft';
}

class Offer extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.request_id = body?.request_id;
    this.provider_id = body?.provider_id;
    this.title = body?.title;
    this.description = body?.description;
    this.items = bindJsonDocument(body?.items);
    this.total_amount = body?.total_amount;
    this.deposit_amount = body?.deposit_amount;
    this.deposit_percentage = body?.deposit_percentage;
    this.commission_mode = body?.commission_mode === 'on_top' ? 'on_top' : body?.commission_mode === 'included' ? 'included' : body?.commission_mode;
    this.payment_flow = body?.payment_flow === 'direct_full_payment' ? 'direct_full_payment' : body?.payment_flow === 'deposit_flow' ? 'deposit_flow' : body?.payment_flow;
    this.partnership_id = body?.partnership_id;
    if (body && Object.prototype.hasOwnProperty.call(body, 'partnership_split')) {
      const v = body.partnership_split;
      if (v === null) this.partnership_split = null;
      else if (v === undefined) this.partnership_split = undefined;
      else if (typeof v === 'object') this.partnership_split = bindJsonDocument(v);
      else this.partnership_split = v;
    } else {
      this.partnership_split = body?.partnership_split;
    }
    this.conditions = body?.conditions;
    this.valid_until = body?.valid_until;
    this.status = normalizeOfferStatus(body?.status);
    this.installment_requested = body?.installment_requested;
    this.installment_count = body?.installment_count;
    this.installment_status = body?.installment_status;
    this.created_at = body?.created_at;
    this.updated_date = body?.updated_date;
  }
}

Offer.findAll = (opts) => new Offer({}).findAll(opts);
Offer.findById = (id) => new Offer({}).findById(id);
Offer.create = (data) => new Offer(data).create();
Offer.update = (id, data) => new Offer({ id, ...data }).update();
Offer.delete = (id) => new Offer({ id }).delete();

module.exports = Offer;
