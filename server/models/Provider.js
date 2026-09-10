/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');
const { coercePortfolioImages, bindJsonDocument } = require('../utils/portfolioImages');

const TABLE = 'providers';
const COLUMNS = [
  'id', 'user_id', 'display_name', 'profession', 'bio', 'photo_url', 'banner_url', 'city', 'lat', 'lng', 'category_id',
  'activity_type', 'suggested_category_name', 'suggested_category_type',
  'price_from', 'provider_tier', 'premium_commission_percent', 'portfolio_images', 'is_verified', 'rating', 'review_count', 'status', 'company_name', 'structure_type', 'worker_count', 'siret', 'vat_number',
  'legal_address', 'coords', 'insurance_certificate', 'video_url',
  'website_url', 'facebook_url', 'instagram_url', 'tiktok_url', 'linkedin_url',
  'access', 'status_verification', 'created_at', 'updated_date',
  'stripe_account_id', 'stripe_connect_status', 'stripe_payouts_enabled', 'stripe_connect_requested_at',
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
    this.lat = body?.lat;
    this.lng = body?.lng;
    this.category_id = body?.category_id;
    this.activity_type = body?.activity_type;
    this.suggested_category_name = body?.suggested_category_name;
    this.suggested_category_type = body?.suggested_category_type;
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
    this.structure_type = body?.structure_type;
    this.worker_count = body?.worker_count;
    this.siret = body?.siret;
    this.vat_number = body?.vat_number;
    this.legal_address = body?.legal_address;
    this.coords = body?.coords;
    this.insurance_certificate = body?.insurance_certificate;
    this.video_url = body?.video_url;
    this.website_url = body?.website_url;
    this.facebook_url = body?.facebook_url;
    this.instagram_url = body?.instagram_url;
    this.tiktok_url = body?.tiktok_url;
    this.linkedin_url = body?.linkedin_url;
    this.access = body?.access;
    this.status_verification = body?.status_verification;
    this.created_at = body?.created_at;
    this.updated_date = body?.updated_date;
    this.stripe_account_id = body?.stripe_account_id;
    this.stripe_connect_status = body?.stripe_connect_status;
    this.stripe_payouts_enabled = body?.stripe_payouts_enabled;
    this.stripe_connect_requested_at = body?.stripe_connect_requested_at;
  }
}

Provider.findAll = (opts) => new Provider({}).findAll(opts);
Provider.countAll = (opts) => new Provider({}).countAll(opts);
Provider.findById = (id) => new Provider({}).findById(id);
Provider.findByUserId = (userId) => new Provider({}).findByUserId(userId);
Provider.create = (data) => new Provider(data).create();
Provider.update = (id, data) => new Provider({ id, ...data }).update();
Provider.delete = (id) => new Provider({ id }).delete();

module.exports = Provider;
