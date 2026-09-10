/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');
const { bindJsonDocument } = require('../utils/portfolioImages');

const TABLE = 'service_items';
const COLUMNS = [
  'id', 'provider_id', 'item_type', 'title', 'description', 'price', 'price_type', 'duration',
  'unit', 'stock_quantity', 'min_order_quantity',
  'order', 'is_active', 'includes', 'image_url', 'stripe_product_id', 'stripe_price_id',
  'created_date', 'updated_date', 'created_by',
];

class ServiceItem extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.provider_id = body?.provider_id;
    this.item_type = body?.item_type || 'package';
    this.title = body?.title;
    this.description = body?.description;
    this.price = body?.price;
    this.price_type = body?.price_type || 'fixed';
    this.duration = body?.duration;
    this.unit = body?.unit;
    this.stock_quantity = body?.stock_quantity;
    this.min_order_quantity = body?.min_order_quantity;
    this.order = body?.order ?? 0;
    this.is_active = body?.is_active ?? 1;
    this.includes = bindJsonDocument(body?.includes ?? []);
    this.image_url = body?.image_url;
    this.stripe_product_id = body?.stripe_product_id || null;
    this.stripe_price_id = body?.stripe_price_id || null;
    this.created_date = body?.created_date ;
    this.updated_date = body?.updated_date ;
    this.created_by = body?.created_by || null;
  }
}

ServiceItem.findAll = (opts) => new ServiceItem({}).findAll(opts);
ServiceItem.findById = (id) => new ServiceItem({}).findById(id);
ServiceItem.create = (data) => new ServiceItem(data).create();
ServiceItem.update = (id, data) => new ServiceItem({ id, ...data }).update();
ServiceItem.delete = (id) => new ServiceItem({ id }).delete();

module.exports = ServiceItem;
