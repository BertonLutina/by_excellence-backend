/* eslint-disable prettier/prettier */
const { executeSQL } = require('../db/db');

const TABLE = 'favorites';

/**
 * Favorites use composite PK (client_id, provider_id). id param can be "clientId_providerId".
 */
class Favorite {
  constructor(body = {}) {
    this.client_id = body?.client_id;
    this.provider_id = body?.provider_id;
    this.created_at = body?.created_at;
  }

  static _parseId(id) {
    if (!id || typeof id !== 'string') return null;
    const parts = id.split('_');
    if (parts.length !== 2) return null;
    return { client_id: parts[0], provider_id: parts[1] };
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
    // Use literal LIMIT/OFFSET integers — prepared LIMIT ? OFFSET ? can trigger
    // ER_WRONG_ARGUMENTS / "Incorrect arguments to mysqld_stmt_execute" on some MySQL/Percona builds.
    const safeLimit = Math.max(0, Math.floor(Number(limit) || 100));
    const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));
    const sql = `SELECT * FROM \`${TABLE}\` ${where} ORDER BY \`${sortCol}\` ${sortDir} LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const result = await executeSQL(sql, values);
    return Array.isArray(result) ? result : [];
  }

  async findById(id) {
    const parsed = Favorite._parseId(id);
    if (!parsed) return null;
    const sql = `SELECT * FROM \`${TABLE}\` WHERE client_id = ? AND provider_id = ?`;
    const result = await executeSQL(sql, [parsed.client_id, parsed.provider_id]);
    const rows = Array.isArray(result) ? result : [result];
    return rows[0] || null;
  }

  async create() {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sql = `INSERT INTO \`${TABLE}\` (client_id, provider_id, created_at) VALUES (?, ?, ?)`;
    await executeSQL(sql, [this.client_id, this.provider_id, now]);
    return this.findById(`${this.client_id}_${this.provider_id}`);
  }

  async delete(id) {
    const parsed = Favorite._parseId(id);
    if (!parsed) return { id: null };
    const sql = `DELETE FROM \`${TABLE}\` WHERE client_id = ? AND provider_id = ?`;
    await executeSQL(sql, [parsed.client_id, parsed.provider_id]);
    return { id };
  }
}

Favorite.findAll = (opts) => new Favorite({}).findAll(opts);
Favorite.findById = (id) => new Favorite({}).findById(id);
Favorite.create = (data) => new Favorite(data).create();
Favorite.update = () => Promise.resolve(null);
Favorite.delete = (id) => new Favorite({}).delete(id);

module.exports = Favorite;
