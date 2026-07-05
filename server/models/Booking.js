/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'bookings';
const COLUMNS = [
  'id', 'request_id', 'offer_id', 'provider_id', 'client_id',
  'slot_date', 'start_time', 'end_time', 'status',
  'cancelled_by', 'cancel_reason', 'created_at', 'updated_date',
];

/**
 * A scheduled appointment between a client and a provider.
 *   status: requested | confirmed | completed | cancelled | declined | no_show
 * Times are "HH:MM" within slot_date (a DATE). Conflict checks use timeSlots.js.
 */
class Booking extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.request_id = body?.request_id;
    this.offer_id = body?.offer_id;
    this.provider_id = body?.provider_id;
    this.client_id = body?.client_id;
    this.slot_date = body?.slot_date;
    this.start_time = body?.start_time;
    this.end_time = body?.end_time;
    this.status = body?.status;
    this.cancelled_by = body?.cancelled_by;
    this.cancel_reason = body?.cancel_reason;
    this.created_at = body?.created_at;
    this.updated_date = body?.updated_date;
  }
}

Booking.findAll = (opts) => new Booking({}).findAll(opts);
Booking.findById = (id) => new Booking({}).findById(id);
Booking.create = (data) => new Booking(data).create();
Booking.update = (id, data) => new Booking({ id, ...data }).update();
Booking.delete = (id) => new Booking({ id }).delete();

module.exports = Booking;
