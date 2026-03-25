/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'admins';
const COLUMNS = ['id', 'user_id', 'full_name', 'created_at', 'updated_date'];

class Admin extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.user_id = body?.user_id;
    this.full_name = body?.full_name;
    this.created_at = body?.created_at;
    this.updated_date = body?.updated_date;
  }
}

Admin.findAll = (opts) => new Admin({}).findAll(opts);
Admin.findById = (id) => new Admin({}).findById(id);
Admin.findByUserId = (userId) => new Admin({}).findByUserId(userId);
Admin.create = (data) => new Admin(data).create();
Admin.update = (id, data) => new Admin({ id, ...data }).update();
Admin.delete = (id) => new Admin({ id }).delete();

module.exports = Admin;
