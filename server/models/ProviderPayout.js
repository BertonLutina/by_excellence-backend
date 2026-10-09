/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'provider_payouts';
const COLUMNS = [
  'id', 'payment_id', 'provider_id', 'amount', 'currency', 'status',
  'created_by', 'created_at', 'paid_at', 'paid_by', 'bank_reference',
];

/**
 * In-app bank-transfer order. By Excellence pays the provider from its own
 * account later; this row never triggers a Stripe transfer or payout.
 *   status: 'to_pay' | 'paid'
 */
class ProviderPayout extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.payment_id = body?.payment_id;
    this.provider_id = body?.provider_id;
    this.amount = body?.amount;
    this.currency = body?.currency;
    this.status = body?.status;
    this.created_by = body?.created_by;
    this.created_at = body?.created_at;
    this.paid_at = body?.paid_at;
    this.paid_by = body?.paid_by;
    this.bank_reference = body?.bank_reference;
  }
}

ProviderPayout.findAll = (opts) => new ProviderPayout({}).findAll(opts);
ProviderPayout.findById = (id) => new ProviderPayout({}).findById(id);
ProviderPayout.create = (data) => new ProviderPayout(data).create();
ProviderPayout.update = (id, data) => new ProviderPayout({ id, ...data }).update();
ProviderPayout.delete = (id) => new ProviderPayout({ id }).delete();

ProviderPayout.findByPaymentId = async (paymentId) => {
  const rows = await ProviderPayout.findAll({
    filters: { payment_id: paymentId },
    limit: 1,
  });
  return rows[0] || null;
};

module.exports = ProviderPayout;
