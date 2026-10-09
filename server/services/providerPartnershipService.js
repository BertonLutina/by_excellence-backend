const { executeSQL } = require('../db/db');
const { bindJsonDocument } = require('../utils/portfolioImages');
const { getEffectiveCommissionPercent } = require('../utils/commission');
const {
  clampLeadSharePercent,
  computePartnershipSplit,
  isPartnershipLive,
  effectivePartnershipStatus,
  buildComboPayloadFromPartnership,
  canModifyCombo,
} = require('../utils/partnershipSplit');

const CONTRACT_VERSION = 'v1';
const ACTIVE_PAIR_STATUSES = ['invited', 'accepted', 'paused'];
const LEAD_UPDATE_STATUSES = new Set(['paused', 'ended', 'accepted']);
const ADMIN_UPDATE_STATUSES = new Set(['paused', 'ended', 'accepted']);
const PARTNER_RESPONSE = new Set(['accepted', 'declined']);

class PartnershipError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.name = 'PartnershipError';
  }
}

const SELECT_WITH_PROVIDERS = `
  SELECT
    pp.*,
    lead.display_name AS lead_display_name,
    lead.profession AS lead_profession,
    lead.photo_url AS lead_photo_url,
    lead.status AS lead_status,
    lead.is_verified AS lead_is_verified,
    partner.display_name AS partner_display_name,
    partner.profession AS partner_profession,
    partner.photo_url AS partner_photo_url,
    partner.status AS partner_status,
    partner.is_verified AS partner_is_verified
  FROM provider_partnerships pp
  INNER JOIN providers lead ON lead.id = pp.lead_provider_id
  INNER JOIN providers partner ON partner.id = pp.partner_provider_id
`;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDate(raw) {
  if (raw == null || raw === '') return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toMysqlDateTime(d) {
  if (!d) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function parseBool(v, fallback = true) {
  if (v === undefined || v === null || v === '') return fallback;
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  if (v === false || v === 0 || v === '0' || v === 'false') return false;
  return fallback;
}

async function listItems(partnershipId) {
  const pid = num(partnershipId);
  if (!pid) return [];
  const rows = await executeSQL(
    `SELECT i.*, si.title, si.item_type, si.price, si.unit_price, si.image_url
     FROM provider_partnership_items i
     LEFT JOIN service_items si ON si.id = i.service_item_id
     WHERE i.partnership_id = ?
     ORDER BY i.id`,
    [pid]
  );
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: Number(r.id),
    partnership_id: Number(r.partnership_id),
    service_item_id: r.service_item_id != null ? Number(r.service_item_id) : null,
    owner_provider_id: Number(r.owner_provider_id),
    title: r.title || null,
    item_type: r.item_type || null,
    price: r.price != null ? Number(r.price) : null,
    unit_price: r.unit_price != null ? Number(r.unit_price) : null,
    image_url: r.image_url || null,
  }));
}

function decorate(row, { includeShare = true, now } = {}) {
  if (!row) return null;
  const status = effectivePartnershipStatus(row, now);
  const live = isPartnershipLive({ ...row, status: row.status }, now);
  const teamBadge = Boolean(row.lead_is_verified) && Boolean(row.partner_is_verified) && live;
  const out = {
    id: Number(row.id),
    lead_provider_id: Number(row.lead_provider_id),
    partner_provider_id: Number(row.partner_provider_id),
    status,
    stored_status: row.status,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    scope_type: row.scope_type,
    is_public: Boolean(row.is_public),
    combo_title: row.combo_title,
    combo_description: row.combo_description,
    combo_price_from: row.combo_price_from != null ? Number(row.combo_price_from) : null,
    combo_image_url: row.combo_image_url,
    contract_version: row.contract_version,
    lead_contract_accepted_at: row.lead_contract_accepted_at,
    partner_contract_accepted_at: row.partner_contract_accepted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_live: live,
    team_badge: teamBadge,
    lead: {
      id: Number(row.lead_provider_id),
      display_name: row.lead_display_name,
      profession: row.lead_profession,
      photo_url: row.lead_photo_url,
      status: row.lead_status,
      is_verified: Boolean(row.lead_is_verified),
    },
    partner: {
      id: Number(row.partner_provider_id),
      display_name: row.partner_display_name,
      profession: row.partner_profession,
      photo_url: row.partner_photo_url,
      status: row.partner_status,
      is_verified: Boolean(row.partner_is_verified),
    },
    items: row.items || [],
  };
  if (includeShare) out.lead_share_percent = Number(row.lead_share_percent);
  return out;
}

function publicView(row) {
  const d = decorate(row, { includeShare: false });
  if (!d) return null;
  return {
    id: d.id,
    lead_provider_id: d.lead_provider_id,
    partner_provider_id: d.partner_provider_id,
    status: d.status,
    starts_at: d.starts_at,
    ends_at: d.ends_at,
    scope_type: d.scope_type,
    is_public: d.is_public,
    combo_title: d.combo_title,
    combo_description: d.combo_description,
    combo_price_from: d.combo_price_from,
    combo_image_url: d.combo_image_url,
    is_live: d.is_live,
    team_badge: d.team_badge,
    lead: d.lead,
    partner: d.partner,
    items: (d.items || []).map((i) => ({
      id: i.id,
      service_item_id: i.service_item_id,
      owner_provider_id: i.owner_provider_id,
      title: i.title,
      item_type: i.item_type,
    })),
  };
}

async function expireIfNeeded(row) {
  if (!row || row.status !== 'accepted') return row;
  if (!row.ends_at || new Date(row.ends_at) > new Date()) return row;
  await executeSQL(
    `UPDATE provider_partnerships SET status = 'expired', updated_at = NOW() WHERE id = ? AND status = 'accepted'`,
    [row.id]
  );
  return { ...row, status: 'expired' };
}

async function getById(id) {
  const pid = num(id);
  if (!pid) return null;
  const rows = await executeSQL(`${SELECT_WITH_PROVIDERS} WHERE pp.id = ? LIMIT 1`, [pid]);
  let row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return null;
  row = await expireIfNeeded(row);
  row.items = await listItems(pid);
  return row;
}

async function findActivePair(a, b) {
  const rows = await executeSQL(
    `SELECT id, status FROM provider_partnerships
     WHERE ((lead_provider_id = ? AND partner_provider_id = ?)
         OR (lead_provider_id = ? AND partner_provider_id = ?))
       AND status IN (${ACTIVE_PAIR_STATUSES.map(() => '?').join(',')})
     LIMIT 1`,
    [a, b, b, a, ...ACTIVE_PAIR_STATUSES]
  );
  return Array.isArray(rows) ? rows[0] : rows;
}

async function replaceItems(partnershipId, items, leadId, partnerId) {
  await executeSQL('DELETE FROM provider_partnership_items WHERE partnership_id = ?', [partnershipId]);
  const list = Array.isArray(items) ? items : [];
  for (const raw of list) {
    const itemId = num(raw.service_item_id || raw.package_id);
    if (!itemId) continue;
    const owner = num(raw.owner_provider_id) || leadId;
    if (owner !== leadId && owner !== partnerId) {
      throw new PartnershipError('owner_provider_id must be the lead or the partner');
    }
    const owned = await executeSQL(
      'SELECT id, provider_id FROM service_items WHERE id = ? LIMIT 1',
      [itemId]
    );
    const item = Array.isArray(owned) ? owned[0] : owned;
    if (!item) throw new PartnershipError('Unknown catalog item in partnership scope');
    if (Number(item.provider_id) !== owner) {
      throw new PartnershipError('Catalog item does not belong to the declared owner');
    }
    await executeSQL(
      `INSERT INTO provider_partnership_items (partnership_id, service_item_id, owner_provider_id)
       VALUES (?, ?, ?)`,
      [partnershipId, itemId, owner]
    );
  }
}

async function invite(leadProviderId, body = {}) {
  const leadId = num(leadProviderId);
  const partnerId = num(body.partner_provider_id);
  if (!leadId) throw new PartnershipError('Lead provider is required');
  if (!partnerId) throw new PartnershipError('partner_provider_id is required');
  if (leadId === partnerId) throw new PartnershipError('Cannot partner with yourself');
  if (!body.accept_contract) throw new PartnershipError('Lead must accept the partnership contract');

  const partnerRows = await executeSQL(
    'SELECT id, status FROM providers WHERE id = ? LIMIT 1',
    [partnerId]
  );
  const partner = Array.isArray(partnerRows) ? partnerRows[0] : partnerRows;
  if (!partner) throw new PartnershipError('Partner provider not found', 404);
  if (partner.status && partner.status !== 'active') {
    throw new PartnershipError('Partner provider is not active');
  }

  const existing = await findActivePair(leadId, partnerId);
  if (existing) throw new PartnershipError('An active partnership already exists between these providers');

  const scopeType = body.scope_type === 'items' ? 'items' : 'all';
  const items = Array.isArray(body.items) ? body.items : [];
  if (scopeType === 'items' && items.length === 0) {
    throw new PartnershipError('scope_type=items requires at least one catalog item');
  }

  const startsAt = parseDate(body.starts_at) || new Date();
  const endsAt = parseDate(body.ends_at);
  if (endsAt && endsAt <= startsAt) throw new PartnershipError('ends_at must be after starts_at');

  const share = clampLeadSharePercent(body.lead_share_percent);
  const result = await executeSQL(
    `INSERT INTO provider_partnerships
      (lead_provider_id, partner_provider_id, status, starts_at, ends_at, scope_type,
       lead_share_percent, is_public, combo_title, combo_description, combo_price_from,
       combo_image_url, contract_version, lead_contract_accepted_at)
     VALUES (?, ?, 'invited', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      leadId,
      partnerId,
      toMysqlDateTime(startsAt),
      toMysqlDateTime(endsAt),
      scopeType,
      share,
      parseBool(body.is_public, true) ? 1 : 0,
      body.combo_title != null ? String(body.combo_title).trim() || null : null,
      body.combo_description != null ? String(body.combo_description).trim() || null : null,
      Number.isFinite(Number(body.combo_price_from)) ? Number(body.combo_price_from) : null,
      body.combo_image_url != null ? String(body.combo_image_url).trim() || null : null,
      CONTRACT_VERSION,
    ]
  );
  const id = Number(result?.insertId);
  if (scopeType === 'items') {
    await replaceItems(id, items, leadId, partnerId);
  }
  return getById(id);
}

async function respond(partnershipId, partnerProviderId, body = {}) {
  const row = await getById(partnershipId);
  if (!row) throw new PartnershipError('Partnership not found', 404);
  if (Number(row.partner_provider_id) !== Number(partnerProviderId)) {
    throw new PartnershipError('Only the invited partner can respond', 403);
  }
  if (row.status !== 'invited') throw new PartnershipError('Invitation is no longer pending');

  const status = String(body.status || '').trim();
  if (!PARTNER_RESPONSE.has(status)) throw new PartnershipError('status must be accepted or declined');
  if (status === 'accepted' && !body.accept_contract) {
    throw new PartnershipError('Partner must accept the partnership contract');
  }

  if (status === 'accepted') {
    await executeSQL(
      `UPDATE provider_partnerships
       SET status = 'accepted', partner_contract_accepted_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [row.id]
    );
  } else {
    await executeSQL(
      `UPDATE provider_partnerships SET status = 'declined', updated_at = NOW() WHERE id = ?`,
      [row.id]
    );
  }
  return getById(row.id);
}

async function updateByLeadOrAdmin(partnershipId, { callerProviderId, isAdminUser }, body = {}) {
  const row = await getById(partnershipId);
  if (!row) throw new PartnershipError('Partnership not found', 404);

  const isLead = Number(callerProviderId) === Number(row.lead_provider_id);
  const isPartner = Number(callerProviderId) === Number(row.partner_provider_id);
  if (!isAdminUser && !isLead && !isPartner) throw new PartnershipError('Forbidden', 403);

  const next = {};
  if (body.status != null) {
    const status = String(body.status).trim();
    const allowed = isAdminUser ? ADMIN_UPDATE_STATUSES : LEAD_UPDATE_STATUSES;
    if (!isAdminUser && isPartner) {
      if (status !== 'ended') throw new PartnershipError('Partner can only end the partnership', 403);
    } else if (!isAdminUser && !isLead) {
      throw new PartnershipError('Forbidden', 403);
    }
    if (!allowed.has(status) && !(isPartner && status === 'ended')) {
      throw new PartnershipError('Invalid status transition');
    }
    if (status === 'accepted' && row.status !== 'paused') {
      throw new PartnershipError('Can only resume a paused partnership');
    }
    next.status = status === 'accepted' ? 'accepted' : status;
  }

  const comboFields = ['combo_title', 'combo_description', 'combo_price_from', 'combo_image_url', 'is_public'];
  const wantsComboEdit = comboFields.some((k) => Object.prototype.hasOwnProperty.call(body, k));
  if (wantsComboEdit) {
    if (!isAdminUser && !canModifyCombo(callerProviderId, row)) {
      throw new PartnershipError('Only the lead can edit the combo listing', 403);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'combo_title')) {
      next.combo_title = body.combo_title != null ? String(body.combo_title).trim() || null : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'combo_description')) {
      next.combo_description = body.combo_description != null ? String(body.combo_description).trim() || null : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'combo_price_from')) {
      next.combo_price_from = body.combo_price_from != null && body.combo_price_from !== ''
        ? Number(body.combo_price_from)
        : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'combo_image_url')) {
      next.combo_image_url = body.combo_image_url != null ? String(body.combo_image_url).trim() || null : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'is_public')) {
      next.is_public = parseBool(body.is_public, true) ? 1 : 0;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'ends_at')) {
    if (!isAdminUser && !isLead) throw new PartnershipError('Forbidden', 403);
    next.ends_at = toMysqlDateTime(parseDate(body.ends_at));
  }

  const keys = Object.keys(next);
  if (!keys.length) return row;
  const sets = keys.map((k) => `\`${k}\` = ?`).join(', ');
  await executeSQL(
    `UPDATE provider_partnerships SET ${sets}, updated_at = NOW() WHERE id = ?`,
    [...keys.map((k) => next[k]), row.id]
  );
  return getById(row.id);
}

async function listForProvider(providerId, { includePrivate = true } = {}) {
  const pid = num(providerId);
  if (!pid) return [];
  const rows = await executeSQL(
    `${SELECT_WITH_PROVIDERS}
     WHERE pp.lead_provider_id = ? OR pp.partner_provider_id = ?
     ORDER BY pp.created_at DESC`,
    [pid, pid]
  );
  const list = [];
  for (const raw of Array.isArray(rows) ? rows : []) {
    const row = await expireIfNeeded(raw);
    row.items = await listItems(row.id);
    if (!includePrivate && !row.is_public) continue;
    list.push(row);
  }
  return list;
}

async function listPublicForProvider(providerId) {
  const rows = await listForProvider(providerId, { includePrivate: false });
  return rows
    .filter((row) => isPartnershipLive(row) && Boolean(row.is_public))
    .map((row) => publicView(row));
}

async function listAll({ status } = {}) {
  const values = [];
  let where = '';
  if (status) {
    where = 'WHERE pp.status = ?';
    values.push(status);
  }
  const rows = await executeSQL(
    `${SELECT_WITH_PROVIDERS} ${where} ORDER BY pp.created_at DESC LIMIT 200`,
    values
  );
  const list = [];
  for (const raw of Array.isArray(rows) ? rows : []) {
    const row = await expireIfNeeded(raw);
    row.items = await listItems(row.id);
    list.push(row);
  }
  return list;
}

function isParty(row, providerId) {
  const pid = Number(providerId);
  return pid === Number(row.lead_provider_id) || pid === Number(row.partner_provider_id);
}

async function applyPartnershipToCreateBody(body, partnershipId) {
  const row = await getById(partnershipId);
  if (!row) throw new PartnershipError('Partnership not found', 404);
  if (!isPartnershipLive(row)) throw new PartnershipError('Partnership is not active');
  const combo = buildComboPayloadFromPartnership(row);
  if (!combo) throw new PartnershipError('Invalid partnership pair');
  return {
    provider_id: Number(row.lead_provider_id),
    provider_name: row.lead_display_name || body.provider_name,
    partnership_id: Number(row.id),
    is_combo: true,
    combo_payload: combo,
    selected_items: undefined,
  };
}

async function attachSplitToOfferBody(body, partnershipId) {
  const row = await getById(partnershipId);
  if (!row) return { ...body, partnership_id: null, partnership_split: null };
  const providerRows = await executeSQL(
    'SELECT id, provider_tier, premium_commission_percent FROM providers WHERE id = ? LIMIT 1',
    [body.provider_id || row.lead_provider_id]
  );
  const provider = Array.isArray(providerRows) ? providerRows[0] : providerRows;
  const rate = getEffectiveCommissionPercent(provider || {});
  const split = computePartnershipSplit({
    items: body.items,
    commissionMode: body.commission_mode,
    commissionRatePercent: rate,
    leadSharePercent: row.lead_share_percent,
    leadProviderId: row.lead_provider_id,
    partnerProviderId: row.partner_provider_id,
  });
  return {
    ...body,
    partnership_id: Number(row.id),
    partnership_split: bindJsonDocument(split),
  };
}

module.exports = {
  CONTRACT_VERSION,
  PartnershipError,
  decorate,
  publicView,
  getById,
  invite,
  respond,
  updateByLeadOrAdmin,
  listForProvider,
  listPublicForProvider,
  listAll,
  isParty,
  applyPartnershipToCreateBody,
  attachSplitToOfferBody,
  listItems,
};
