/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'disputes';
const COLUMNS = [
  'id', 'payment_id', 'request_id', 'opened_by', 'opened_by_role',
  'reason', 'status', 'resolution', 'resolved_by', 'resolved_at',
  'created_at', 'updated_date',
];

/**
 * A dispute freezes a held escrow until an admin resolves it.
 *   status: 'open' | 'resolved'
 *   resolution: null | 'released' | 'refunded'  (mirrors the escrow outcome)
 *   opened_by_role: 'client' | 'provider'
 */
class Dispute extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.payment_id = body?.payment_id;
    this.request_id = body?.request_id;
    this.opened_by = body?.opened_by;
    this.opened_by_role = body?.opened_by_role;
    this.reason = body?.reason;
    this.status = body?.status;
    this.resolution = body?.resolution;
    this.resolved_by = body?.resolved_by;
    this.resolved_at = body?.resolved_at;
    this.created_at = body?.created_at;
    this.updated_date = body?.updated_date;
  }
}

Dispute.findAll = (opts) => new Dispute({}).findAll(opts);
Dispute.findById = (id) => new Dispute({}).findById(id);
Dispute.create = (data) => new Dispute(data).create();
Dispute.update = (id, data) => new Dispute({ id, ...data }).update();
Dispute.delete = (id) => new Dispute({ id }).delete();

module.exports = Dispute;
