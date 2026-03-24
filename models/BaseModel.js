/* eslint-disable prettier/prettier */
const { executeSQL } = require('../db/db');
const { v4: uuidv4 } = require('uuid');

class BaseModel {
  constructor(body, table, columns, options = {}) {
    this.table = table;
    this.columns = columns || [];
    this.autoIncrement = options.autoIncrement === true;
    // Subclasses assign from body explicitly in their constructor
  }

  get() {
    const o = {};
    for (const col of this.columns) {
      o[col] = this[col];
    }
    return o;
  }

  set(body) {
    for (const col of this.columns) {
      this[col] = body?.[col];
    }
  }

  getInsertColumns() {
    if (this.autoIncrement) return this.columns.filter((c) => c !== 'id');
    return this.columns;
  }

  getUpdateColumns() {
    return this.columns.filter(
      (c) => c !== 'id' && c !== 'created_date' && c !== 'created_at'
    );
  }

  getValuesInsert() {
    return this.getInsertColumns().map((c) => this[c]);
  }

  getValues() {
    const upd = this.getUpdateColumns();
    return [...upd.map((c) => this[c]), this.id];
  }

  async findById(id) {
    const sql = `SELECT * FROM \`${this.table}\` WHERE id = ?`;
    const result = await executeSQL(sql, [id]);
    const rows = Array.isArray(result) ? result : [result];
    return rows[0] || null;
  }

  async findByUserId(userId) {
    const sql = `SELECT * FROM \`${this.table}\` WHERE user_id = ?`;
    const result = await executeSQL(sql, [userId]);
    const rows = Array.isArray(result) ? result : [result];
    return rows[0] || null;
  }

  async findAll({ filters = {}, sort = 'created_at', order = 'DESC', limit = 100, offset = 0 } = {}) {
    const conditions = [];
    const values = [];
    for (const [key, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null) {
        conditions.push(`\`${key}\` = ?`);
        values.push(val);
      }
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortCol = sort.startsWith('-') ? sort.slice(1) : sort;
    const sortDir = sort.startsWith('-') ? 'DESC' : order || 'ASC';
    const safeLimit = Number(limit) || 100;
    const safeOffset = Number(offset) || 0;
    const sql = `SELECT * FROM \`${this.table}\` ${where} ORDER BY \`${sortCol}\` ${sortDir} LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const result = await executeSQL(sql, values);
    return Array.isArray(result) ? result : [];
  }

  async create() {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (!this.autoIncrement) this.id = this.id || uuidv4();
    if (this.columns.includes('created_date')) this.created_date = now;
    if (this.columns.includes('created_at')) this.created_at = now;
    if (this.columns.includes('updated_date')) this.updated_date = now;
    const cols = this.getInsertColumns();
    const placeholders = cols.map(() => '?').join(', ');
    const colsList = cols.map((c) => `\`${c}\``).join(', ');
    const sql = `INSERT INTO \`${this.table}\` (${colsList}) VALUES (${placeholders})`;
    const values = this.getValuesInsert();
    const result = await executeSQL(sql, values);
    if (this.autoIncrement && result && result.insertId)
      this.id = result.insertId;
    return this.findById(this.id);
  }

  async update() {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (this.columns.includes('updated_date')) this.updated_date = now;
    const cols = this.getUpdateColumns();
    const sets = cols.map((c) => `\`${c}\` = ?`).join(', ');
    const sql = `UPDATE \`${this.table}\` SET ${sets} WHERE id = ?`;
    const values = this.getValues();
    await executeSQL(sql, values);
    return this.findById(this.id);
  }

  async delete() {
    const sql = `DELETE FROM \`${this.table}\` WHERE id = ?`;
    await executeSQL(sql, [this.id]);
    return { id: this.id };
  }
}

module.exports = BaseModel;
