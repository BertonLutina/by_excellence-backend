/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'service_requests';
const COLUMNS = [
  'id', 'client_id', 'provider_id', 'service_description', 'preferred_date', 'budget', 'status',
  'confirmed_date', 'admin_notes', 'created_at', 'updated_date',
];

class ServiceRequest extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.client_id = body?.client_id;
    this.provider_id = body?.provider_id;
    this.service_description = body?.service_description;
    this.preferred_date = body?.preferred_date;
    this.budget = body?.budget;
    this.status = body?.status;
    this.confirmed_date = body?.confirmed_date;
    this.admin_notes = body?.admin_notes;
    this.created_at = body?.created_at;
    this.updated_date = body?.updated_date;
  }
}

ServiceRequest.findAll = (opts) => new ServiceRequest({}).findAll(opts);
ServiceRequest.findById = (id) => new ServiceRequest({}).findById(id);
ServiceRequest.create = (data) => new ServiceRequest(data).create();
ServiceRequest.update = (id, data) => new ServiceRequest({ id, ...data }).update();
ServiceRequest.delete = (id) => new ServiceRequest({ id }).delete();

module.exports = ServiceRequest;
