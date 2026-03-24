/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'provider_availability';
const COLUMNS = ['id', 'provider_id', 'day_of_week', 'start_time', 'end_time', 'is_available'];

class ProviderAvailability extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.provider_id = body?.provider_id;
    this.day_of_week = body?.day_of_week;
    this.start_time = body?.start_time;
    this.end_time = body?.end_time;
    this.is_available = body?.is_available;
  }
}

ProviderAvailability.findAll = (opts) => new ProviderAvailability({}).findAll(opts);
ProviderAvailability.findById = (id) => new ProviderAvailability({}).findById(id);
ProviderAvailability.create = (data) => new ProviderAvailability(data).create();
ProviderAvailability.update = (id, data) => new ProviderAvailability({ id, ...data }).update();
ProviderAvailability.delete = (id) => new ProviderAvailability({ id }).delete();

module.exports = ProviderAvailability;
