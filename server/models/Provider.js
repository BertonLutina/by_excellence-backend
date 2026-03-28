/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');
const { coercePortfolioImages, bindJsonDocument } = require('../utils/portfolioImages');

const TABLE = 'providers';
const COLUMNS = [
  'id', 'user_id', 'display_name', 'profession', 'bio', 'photo_url', 'banner_url', 'city', 'category_id',
  'price_from', 'provider_tier', 'premium_commission_percent', 'portfolio_images', 'is_verified', 'rating', 'review_count', 'status', 'company_name', 'siret', 'vat_number',
  'legal_address', 'insurance_certificate', 'video_url', 'created_at', 'updated_date',
];

class Provider extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.user_id = body?.user_id;
    this.display_name = body?.display_name;
    this.profession = body?.profession;
    this.bio = body?.bio;
    this.photo_url = body?.photo_url;
    this.banner_url = body?.banner_url;
    this.city = body?.city;
    this.category_id = body?.category_id;
    this.price_from = body?.price_from;
    this.provider_tier = body?.provider_tier;
    this.premium_commission_percent = body?.premium_commission_percent;
    if (body && Object.prototype.hasOwnProperty.call(body, 'portfolio_images')) {
      this.portfolio_images = bindJsonDocument(coercePortfolioImages(body.portfolio_images));
    } else {
      this.portfolio_images = body?.portfolio_images;
    }
    this.is_verified = body?.is_verified;
    this.rating = body?.rating;
    this.review_count = body?.review_count;
    this.status = body?.status;
    this.company_name = body?.company_name;
    this.siret = body?.siret;
    this.vat_number = body?.vat_number;
    this.legal_address = body?.legal_address;
    this.insurance_certificate = body?.insurance_certificate;
    this.video_url = body?.video_url;
    this.created_at = body?.created_at;
    this.updated_date = body?.updated_date;
  }
}

Provider.findAll = (opts) => new Provider({}).findAll(opts);
Provider.findById = (id) => new Provider({}).findById(id);
Provider.findByUserId = (userId) => new Provider({}).findByUserId(userId);
Provider.create = (data) => new Provider(data).create();
Provider.update = (id, data) => new Provider({ id, ...data }).update();
Provider.delete = (id) => new Provider({ id }).delete();

module.exports = Provider;
