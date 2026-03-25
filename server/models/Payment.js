/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');
const { executeSQL } = require('../db/db');

const TABLE = 'payments';
const COLUMNS = [
  'id', 'request_id', 'offer_id', 'type', 'installment_index', 'installment_total',
  'amount', 'commission_rate_percent', 'admin_commission_amount', 'provider_net_amount',
  'status', 'paid_date', 'payment_method', 'invoice_url', 'created_at', 'updated_date',
];

class Payment extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.request_id = body?.request_id;
    this.offer_id = body?.offer_id;
    this.type = body?.type;
    this.installment_index = body?.installment_index;
    this.installment_total = body?.installment_total;
    this.amount = body?.amount;
    this.commission_rate_percent = body?.commission_rate_percent;
    this.admin_commission_amount = body?.admin_commission_amount;
    this.provider_net_amount = body?.provider_net_amount;
    this.status = body?.status;
    this.paid_date = body?.paid_date;
    this.payment_method = body?.payment_method;
    this.invoice_url = body?.invoice_url;
    this.created_at = body?.created_at;
    this.updated_date = body?.updated_date;
  }

  /** Override: join service_requests when filtering by client_id or provider_id (payments table has neither). */
  async findAll(opts = {}) {
    const { filters = {}, sort = 'created_at', order = 'DESC', limit = 100, offset = 0 } = opts;
    const { client_id, provider_id, ...restFilters } = filters;
    const needsJoin = client_id != null || provider_id != null;
    if (!needsJoin) return super.findAll(opts);

    const conditions = [];
    const values = [];
    if (client_id != null) {
      conditions.push('r.client_id = ?');
      values.push(client_id);
    }
    if (provider_id != null) {
      conditions.push('r.provider_id = ?');
      values.push(provider_id);
    }
    for (const [key, val] of Object.entries(restFilters)) {
      if (val !== undefined && val !== null) {
        conditions.push(`p.\`${key}\` = ?`);
        values.push(val);
      }
    }
    const sortCol = sort.startsWith('-') ? sort.slice(1) : sort;
    const sortDir = sort.startsWith('-') ? 'DESC' : order || 'ASC';
    const safeLimit = Number(limit) || 100;
    const safeOffset = Number(offset) || 0;
    const sql = `SELECT p.* FROM \`${TABLE}\` p
      INNER JOIN service_requests r ON p.request_id = r.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.\`${sortCol}\` ${sortDir} LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const result = await executeSQL(sql, values);
    return Array.isArray(result) ? result : [];
  }
}

Payment.findAll = (opts) => new Payment({}).findAll(opts);
Payment.findById = (id) => new Payment({}).findById(id);
Payment.create = (data) => new Payment(data).create();
Payment.update = (id, data) => new Payment({ id, ...data }).update();
Payment.delete = (id) => new Payment({ id }).delete();

module.exports = Payment;
