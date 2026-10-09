/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'personal_planning_items';
const COLUMNS = [
  'id',
  'user_id',
  'title',
  'notes',
  'plan_date',
  'start_time',
  'end_time',
  'is_done',
  'created_at',
  'updated_at',
];

class PersonalPlanningItem extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.user_id = body?.user_id;
    this.title = body?.title;
    this.notes = body?.notes;
    this.plan_date = body?.plan_date;
    this.start_time = body?.start_time;
    this.end_time = body?.end_time;
    if (body && Object.prototype.hasOwnProperty.call(body, 'is_done')) {
      this.is_done = Boolean(body.is_done);
    } else {
      this.is_done = body?.is_done;
    }
    this.created_at = body?.created_at;
    this.updated_at = body?.updated_at;
  }
}

PersonalPlanningItem.findAll = (opts) => new PersonalPlanningItem({}).findAll(opts);
PersonalPlanningItem.findById = (id) => new PersonalPlanningItem({}).findById(id);
PersonalPlanningItem.create = (data) => new PersonalPlanningItem(data).create();
PersonalPlanningItem.update = (id, data) => new PersonalPlanningItem({ id, ...data }).update();
PersonalPlanningItem.delete = (id) => new PersonalPlanningItem({ id }).delete();

module.exports = PersonalPlanningItem;
