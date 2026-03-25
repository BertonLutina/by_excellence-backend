/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'service_categories';
const COLUMNS = ['id', 'name', 'description', 'icon', 'image_url', 'created_at'];

class ServiceCategory extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.name = body?.name;
    this.description = body?.description;
    this.icon = body?.icon;
    this.image_url = body?.image_url;
    this.created_at = body?.created_at;
  }
}

ServiceCategory.findAll = (opts) => new ServiceCategory({}).findAll(opts);
ServiceCategory.findById = (id) => new ServiceCategory({}).findById(id);
ServiceCategory.create = (data) => new ServiceCategory(data).create();
ServiceCategory.update = (id, data) => new ServiceCategory({ id, ...data }).update();
ServiceCategory.delete = (id) => new ServiceCategory({ id }).delete();

module.exports = ServiceCategory;
