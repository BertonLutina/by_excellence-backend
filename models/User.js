/* eslint-disable prettier/prettier */
const { executeSQL } = require('../db/db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const genToken = () => crypto.randomBytes(32).toString('hex');
const addMinutes = (mins) => {
  const d = new Date(Date.now() + mins * 60000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

const TABLE = 'users';
const ROLE_TO_ID = { client: 1, provider: 2, admin: 3 };
const ID_TO_ROLE = { 1: 'client', 2: 'provider', 3: 'admin' };

class User {
  constructor(body = {}) {
    this.id = body?.id;
    this.email = body?.email;
    this.password_hash = body?.password_hash;
    this.full_name = body?.full_name;
    this.role_id = body?.role_id ?? body?.role;
    this.is_email_verified = body?.is_email_verified;
    this.verification_token = body?.verification_token;
    this.verification_token_expires = body?.verification_token_expires;
    this.reset_token = body?.reset_token;
    this.reset_token_expires = body?.reset_token_expires;
    this.created_date = body?.created_date;
    this.updated_date = body?.updated_date;
  }

  get() {
    return {
      id: this.id,
      email: this.email,
      password_hash: this.password_hash,
      full_name: this.full_name,
      role_id: this.role_id,
      is_email_verified: this.is_email_verified,
      verification_token: this.verification_token,
      verification_token_expires: this.verification_token_expires,
      reset_token: this.reset_token,
      reset_token_expires: this.reset_token_expires,
      created_date: this.created_date,
      updated_date: this.updated_date,
    };
  }

  set(body = {}) {
    this.id = body?.id;
    this.email = body?.email;
    this.password_hash = body?.password_hash;
    this.full_name = body?.full_name;
    this.role_id = body?.role_id ?? body?.role;
    this.is_email_verified = body?.is_email_verified;
    this.verification_token = body?.verification_token;
    this.verification_token_expires = body?.verification_token_expires;
    this.reset_token = body?.reset_token;
    this.reset_token_expires = body?.reset_token_expires;
    this.created_date = body?.created_date;
    this.updated_date = body?.updated_date;
  }

  async findById(id) {
    const sql = `SELECT id, email, full_name, role_id AS role, is_email_verified, created_date, updated_date FROM \`${TABLE}\` WHERE id = ?`;
    const rows = await executeSQL(sql, [id]);
    return rows[0] || null;
  }

  async findByEmail(email) {
    const sql = `SELECT id, email, password_hash, full_name, role_id AS role, is_email_verified,
      verification_token, verification_token_expires, reset_token, reset_token_expires,
      created_date, updated_date FROM \`${TABLE}\` WHERE email = ?`;
    const rows = await executeSQL(sql, [email]);
    return rows[0] || null;
  }

  async findAll({ role, search } = {}) {
    let sql = `SELECT id, email, full_name, role_id AS role, is_email_verified, created_date, updated_date FROM \`${TABLE}\``;
    const values = [];
    const conditions = [];
    if (role !== undefined && role !== null) {
      conditions.push('role_id = ?');
      const roleId = typeof role === 'number' ? role : ROLE_TO_ID[role] ?? role;
      values.push(roleId);
    }
    if (search) {
      conditions.push('(email LIKE ? OR full_name LIKE ?)');
      values.push(`%${search}%`, `%${search}%`);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_date DESC';
    return executeSQL(sql, values);
  }

  async findByVerificationToken(token) {
    const sql = `SELECT id, email, full_name, role_id AS role, is_email_verified,
      verification_token, verification_token_expires, created_date, updated_date
      FROM \`${TABLE}\` WHERE verification_token = ? AND verification_token_expires > NOW()`;
    const rows = await executeSQL(sql, [token]);
    return rows[0] || null;
  }

  async findByResetToken(token) {
    const sql = `SELECT id, email, full_name, role_id AS role, is_email_verified,
      reset_token, reset_token_expires, created_date, updated_date
      FROM \`${TABLE}\` WHERE reset_token = ? AND reset_token_expires > NOW()`;
    const rows = await executeSQL(sql, [token]);
    return rows[0] || null;
  }

  async create() {
    const n = now();
    this.verification_token = genToken();
    this.verification_token_expires = addMinutes(24 * 60);
    const roleId =
      typeof this.role_id === 'number'
        ? this.role_id
        : ROLE_TO_ID[this.role_id] || ROLE_TO_ID.client;
    const sql = `INSERT INTO \`${TABLE}\`
      (email, password_hash, full_name, role_id, is_email_verified, verification_token, verification_token_expires, created_date, updated_date)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`;
    const values = [
      this.email,
      this.password_hash,
      this.full_name || null,
      roleId,
      this.verification_token,
      this.verification_token_expires,
      n,
      n,
    ];
    const result = await executeSQL(sql, values);
    if (result && result.insertId) this.id = result.insertId;
    const user = await this.findById(this.id);
    return { ...user, verification_token: this.verification_token };
  }

  async setEmailVerified(id) {
    const sql = `UPDATE \`${TABLE}\` SET is_email_verified = 1, verification_token = NULL, verification_token_expires = NULL, updated_date = ? WHERE id = ?`;
    await executeSQL(sql, [now(), id]);
    return this.findById(id);
  }

  async setNewVerificationToken(id) {
    const token = genToken();
    const expires = addMinutes(24 * 60);
    const sql = `UPDATE \`${TABLE}\` SET verification_token = ?, verification_token_expires = ?, updated_date = ? WHERE id = ?`;
    await executeSQL(sql, [token, expires, now(), id]);
    return token;
  }

  async setResetToken(id) {
    const token = genToken();
    const expires = addMinutes(60);
    const sql = `UPDATE \`${TABLE}\` SET reset_token = ?, reset_token_expires = ?, updated_date = ? WHERE id = ?`;
    await executeSQL(sql, [token, expires, now(), id]);
    return token;
  }

  async clearResetToken(id) {
    const sql = `UPDATE \`${TABLE}\` SET reset_token = NULL, reset_token_expires = NULL, updated_date = ? WHERE id = ?`;
    await executeSQL(sql, [now(), id]);
  }

  async update() {
    const sets = [];
    const values = [];
    if (this.full_name !== undefined) {
      sets.push('full_name = ?');
      values.push(this.full_name);
    }
    if (this.role_id !== undefined) {
      sets.push('role_id = ?');
      const roleId = typeof this.role_id === 'number' ? this.role_id : ROLE_TO_ID[this.role_id] ?? this.role_id;
      values.push(roleId);
    }
    if (!sets.length) return this.findById(this.id);
    sets.push('updated_date = ?');
    values.push(now());
    values.push(this.id);
    const sql = `UPDATE \`${TABLE}\` SET ${sets.join(', ')} WHERE id = ?`;
    await executeSQL(sql, values);
    return this.findById(this.id);
  }

  async updatePassword(id, password_hash) {
    const sql = `UPDATE \`${TABLE}\` SET password_hash = ?, updated_date = ? WHERE id = ?`;
    await executeSQL(sql, [password_hash, now(), id]);
  }

  async delete() {
    const sql = `DELETE FROM \`${TABLE}\` WHERE id = ?`;
    await executeSQL(sql, [this.id]);
    return { id: this.id };
  }
}

User.findById = (id) => new User({}).findById(id);
User.findByEmail = (email) => new User({}).findByEmail(email);
User.findAll = (opts) => new User({}).findAll(opts);
User.findByVerificationToken = (token) => new User({}).findByVerificationToken(token);
User.findByResetToken = (token) => new User({}).findByResetToken(token);
User.create = (data) => new User(data).create();
User.setEmailVerified = (id) => new User({}).setEmailVerified(id);
User.setNewVerificationToken = (id) => new User({}).setNewVerificationToken(id);
User.setResetToken = (id) => new User({}).setResetToken(id);
User.clearResetToken = (id) => new User({}).clearResetToken(id);
User.update = (id, data) => new User({ id, ...data }).update();
User.updatePassword = (id, password_hash) => new User({}).updatePassword(id, password_hash);
User.delete = (id) => new User({ id }).delete();

module.exports = User;
