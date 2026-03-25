/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'service_items';
const COLUMNS = [
  'id', 'provider_id', 'title', 'description', 'price', 'price_type', 'duration',
  'order', 'is_active', 'includes', 'image_url', 'created_date', 'updated_date', 'created_by',
];

class ServiceItem extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS);
    this.id = body?.id;
    this.provider_id = body?.provider_id;
    this.title = body?.title;
    this.description = body?.description;
    this.price = body?.price;
    this.price_type = body?.price_type;
    this.duration = body?.duration;
    this.order = body?.order;
    this.is_active = body?.is_active;
    this.includes = body?.includes;
    this.image_url = body?.image_url;
    this.created_date = body?.created_date;
    this.updated_date = body?.updated_date;
    this.created_by = body?.created_by;
  }
}

ServiceItem.findAll = (opts) => new ServiceItem({}).findAll(opts);
ServiceItem.findById = (id) => new ServiceItem({}).findById(id);
ServiceItem.create = (data) => new ServiceItem(data).create();
ServiceItem.update = (id, data) => new ServiceItem({ id, ...data }).update();
ServiceItem.delete = (id) => new ServiceItem({ id }).delete();

module.exports = ServiceItem;
