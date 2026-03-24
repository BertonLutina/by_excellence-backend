/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'offers';
const COLUMNS = [
  'id', 'request_id', 'provider_id', 'title', 'description', 'items', 'total_amount',
  'deposit_amount', 'deposit_percentage', 'conditions', 'valid_until', 'status', 'installment_requested',
  'installment_count', 'installment_status', 'created_at', 'updated_date',
];

class Offer extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.request_id = body?.request_id;
    this.provider_id = body?.provider_id;
    this.title = body?.title;
    this.description = body?.description;
    this.items = body?.items;
    this.total_amount = body?.total_amount;
    this.deposit_amount = body?.deposit_amount;
    this.deposit_percentage = body?.deposit_percentage;
    this.conditions = body?.conditions;
    this.valid_until = body?.valid_until;
    this.status = body?.status;
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
