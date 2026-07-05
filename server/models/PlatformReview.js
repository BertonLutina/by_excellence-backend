const BaseModel = require('./BaseModel');

const TABLE = 'platform_reviews';
const COLUMNS = [
  'id', 'author_full_name', 'author_profession', 'author_location',
  'author_role', 'author_user_id', 'rating', 'comment',
  'created_at', 'updated_date',
];

class PlatformReview extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.author_full_name = body?.author_full_name;
    this.author_profession = body?.author_profession;
    this.author_location = body?.author_location;
    this.author_role = body?.author_role;
    this.author_user_id = body?.author_user_id;
    this.rating = body?.rating;
    this.comment = body?.comment;
    this.created_at = body?.created_at;
    this.updated_date = body?.updated_date;
  }
}

PlatformReview.findAll = (opts) => new PlatformReview({}).findAll(opts);
PlatformReview.findById = (id) => new PlatformReview({}).findById(id);
PlatformReview.create = (data) => new PlatformReview(data).create();
PlatformReview.update = (id, data) => new PlatformReview({ id, ...data }).update();
PlatformReview.delete = (id) => new PlatformReview({ id }).delete();

module.exports = PlatformReview;
