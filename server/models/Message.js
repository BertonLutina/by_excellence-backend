/* eslint-disable prettier/prettier */
const BaseModel = require('./BaseModel');

const TABLE = 'messages';
const COLUMNS = [
  'id', 'request_id', 'sender_id', 'sender_role', 'content', 'is_read', 'created_at', 'updated_date',
];

class Message extends BaseModel {
  constructor(body = {}) {
    super({}, TABLE, COLUMNS, { autoIncrement: true });
    this.id = body?.id;
    this.request_id = body?.request_id;
    this.sender_id = body?.sender_id;
    this.sender_role = body?.sender_role;
    this.content = body?.content;
    this.is_read = body?.is_read;
    this.created_at = body?.created_at;
    this.updated_date = body?.updated_date;
  }
}

Message.findAll = (opts) => new Message({}).findAll(opts);
Message.findById = (id) => new Message({}).findById(id);
Message.create = (data) => new Message(data).create();
Message.update = (id, data) => new Message({ id, ...data }).update();
Message.delete = (id) => new Message({ id }).delete();

module.exports = Message;
