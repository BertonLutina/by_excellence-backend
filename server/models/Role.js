/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'roles';
const COLUMNS = ['id', 'name'];

class Role extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.name = body?.name;
  }
}

Role.findAll = (opts) => new Role({}).findAll(opts);
Role.findById = (id) => new Role({}).findById(id);

module.exports = Role;
