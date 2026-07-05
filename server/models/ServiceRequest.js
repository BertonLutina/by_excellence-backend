/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');
const { bindJsonDocument } = require('../utils/portfolioImages');
const { executeSQL } = require('../db/db');

const TABLE = 'service_requests';
const COLUMNS = [
  'id',
  'client_id',
  'client_name',
  'client_email',
  'client_phone',
  'provider_id',
  'provider_name',
  'service_description',
  'is_combo',
  'is_open_request',
  'combo_payload',
  'selected_items',
  'preferred_date',
  'budget',
  'status',
  'confirmed_date',
  'admin_notes',
  'created_at',
  'updated_date',
];

class ServiceRequest extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.client_id = body?.client_id;
    this.client_name = body?.client_name;
    this.client_email = body?.client_email;
    this.client_phone = body?.client_phone;
    this.provider_id = body?.provider_id;
    this.provider_name = body?.provider_name;
    this.service_description = body?.service_description;
    if (body && Object.prototype.hasOwnProperty.call(body, 'is_combo')) {
      this.is_combo = Boolean(body.is_combo);
    } else {
      this.is_combo = body?.is_combo;
    }
    if (body && Object.prototype.hasOwnProperty.call(body, 'is_open_request')) {
      this.is_open_request = Boolean(body.is_open_request);
    } else if (body?.is_open_request != null) {
      this.is_open_request = Boolean(body.is_open_request);
    }
    if (body && Object.prototype.hasOwnProperty.call(body, 'combo_payload')) {
      const v = body.combo_payload;
      if (v === null) this.combo_payload = null;
      else if (v === undefined) this.combo_payload = undefined;
      else if (typeof v === 'object') this.combo_payload = bindJsonDocument(v);
      else this.combo_payload = v;
    } else {
      this.combo_payload = body?.combo_payload;
    }
    if (body && Object.prototype.hasOwnProperty.call(body, 'selected_items')) {
      const v = body.selected_items;
      if (v === null) this.selected_items = null;
      else if (v === undefined) this.selected_items = undefined;
      else if (typeof v === 'object') this.selected_items = bindJsonDocument(v);
      else this.selected_items = v;
    } else {
      this.selected_items = body?.selected_items;
    }
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
ServiceRequest.attachClientIdByEmail = async (userId, email) => {
  const uid = Number(userId);
  const em = String(email || '').trim().toLowerCase();
  if (!Number.isFinite(uid) || uid <= 0 || !em) return 0;
  const sql = `
    UPDATE \`${TABLE}\`
    SET client_id = ?
    WHERE client_id IS NULL
      AND client_email IS NOT NULL
      AND LOWER(TRIM(client_email)) = ?
  `;
  const result = await executeSQL(sql, [uid, em]);
  return Number(result?.affectedRows || 0);
};

module.exports = ServiceRequest;
