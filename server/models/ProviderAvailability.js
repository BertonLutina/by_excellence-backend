/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'provider_availability';
const COLUMNS = [
  'id', 'provider_id', 'slot_date', 'day_of_week', 'start_time', 'end_time',
  'is_available', 'booking_type', 'program_note',
];

class ProviderAvailability extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.provider_id = body?.provider_id;
    this.slot_date = body?.slot_date;
    this.day_of_week = body?.day_of_week;
    this.start_time = body?.start_time;
    this.end_time = body?.end_time;
    this.is_available = body?.is_available;
    this.booking_type = body?.booking_type;
    this.program_note = body?.program_note;
  }
}

ProviderAvailability.findAll = (opts) => new ProviderAvailability({}).findAll(opts);
ProviderAvailability.findById = (id) => new ProviderAvailability({}).findById(id);
ProviderAvailability.create = (data) => new ProviderAvailability(data).create();
ProviderAvailability.update = (id, data) => new ProviderAvailability({ id, ...data }).update();
ProviderAvailability.delete = (id) => new ProviderAvailability({ id }).delete();

module.exports = ProviderAvailability;
