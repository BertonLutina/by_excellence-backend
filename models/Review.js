/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'reviews';
const COLUMNS = [
  'id', 'provider_id', 'client_id', 'request_id', 'rating', 'comment',
  'provider_response', 'provider_response_date', 'created_at', 'updated_date',
];

class Review extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.provider_id = body?.provider_id;
    this.client_id = body?.client_id;
    this.request_id = body?.request_id;
    this.rating = body?.rating;
    this.comment = body?.comment;
    this.provider_response = body?.provider_response;
    this.provider_response_date = body?.provider_response_date;
    this.created_at = body?.created_at;
    this.updated_date = body?.updated_date;
  }
}

Review.findAll = (opts) => new Review({}).findAll(opts);
Review.findById = (id) => new Review({}).findById(id);
Review.create = (data) => new Review(data).create();
Review.update = (id, data) => new Review({ id, ...data }).update();
Review.delete = (id) => new Review({ id }).delete();

module.exports = Review;
