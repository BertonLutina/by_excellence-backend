/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'clients';
const COLUMNS = ['id', 'user_id', 'full_name', 'phone', 'created_at', 'updated_date'];

class Client extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.user_id = body?.user_id;
    this.full_name = body?.full_name;
    this.phone = body?.phone;
    this.created_at = body?.created_at;
    this.updated_date = body?.updated_date;
  }
}

Client.findAll = (opts) => new Client({}).findAll(opts);
Client.findById = (id) => new Client({}).findById(id);
Client.findByUserId = (userId) => new Client({}).findByUserId(userId);
Client.create = (data) => new Client(data).create();
Client.update = (id, data) => new Client({ id, ...data }).update();
Client.delete = (id) => new Client({ id }).delete();

module.exports = Client;
