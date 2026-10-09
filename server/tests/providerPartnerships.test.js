const test = require('node:test');
const assert = require('node:assert/strict');

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function loadWithStubs(targetPath, stubMap) {
  const touched = [];
  for (const [requestPath, exports] of Object.entries(stubMap)) {
    const resolved = require.resolve(requestPath);
    touched.push({ resolved, previous: require.cache[resolved] });
    require.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports,
    };
  }
  const targetResolved = require.resolve(targetPath);
  const previousTarget = require.cache[targetResolved];
  delete require.cache[targetResolved];
  try {
    return require(targetPath);
  } finally {
    if (previousTarget) require.cache[targetResolved] = previousTarget;
    else delete require.cache[targetResolved];
    for (const { resolved, previous } of touched) {
      if (previous) require.cache[resolved] = previous;
      else delete require.cache[resolved];
    }
  }
}

const liveRow = {
  id: 3,
  lead_provider_id: 10,
  partner_provider_id: 20,
  status: 'accepted',
  starts_at: '2026-01-01',
  ends_at: null,
  scope_type: 'all',
  lead_share_percent: 60,
  is_public: 1,
  combo_title: 'Duo mariage',
  combo_description: 'Photo + vidéo',
  combo_price_from: 900,
  combo_image_url: null,
  contract_version: 'v1',
  lead_contract_accepted_at: '2026-01-01',
  partner_contract_accepted_at: '2026-01-02',
  created_at: '2026-01-01',
  updated_at: '2026-01-02',
  lead_display_name: 'Amina',
  lead_profession: 'Vidéaste',
  lead_photo_url: null,
  lead_status: 'active',
  lead_is_verified: 1,
  partner_display_name: 'Kwame',
  partner_profession: 'Photographe',
  partner_photo_url: null,
  partner_status: 'active',
  partner_is_verified: 1,
};

test('partner cannot edit the lead combo (403)', async () => {
  const ctrl = loadWithStubs('../controllers/providerPartnershipController', {
    '../utils/entityAccess': {
      isAdmin: () => false,
      providerIdForUser: async () => 20,
    },
    '../services/providerPartnershipService': {
      PartnershipError: class PartnershipError extends Error {
        constructor(message, status = 400) {
          super(message);
          this.status = status;
        }
      },
      decorate: (row) => row,
      publicView: (row) => row,
      getById: async () => liveRow,
      invite: async () => liveRow,
      respond: async () => liveRow,
      updateByLeadOrAdmin: async () => {
        const err = new Error('Only the lead can edit the combo listing');
        err.status = 403;
        throw err;
      },
      listForProvider: async () => [],
      listPublicForProvider: async () => [],
      listAll: async () => [],
      isParty: (row, pid) => pid === 10 || pid === 20,
    },
    '../services/notificationService': {
      notifyPartnershipInvite: async () => {},
      notifyPartnershipResponse: async () => {},
    },
  });

  const req = {
    user: { id: 2, role: 'provider' },
    params: { id: 3 },
    body: { combo_title: 'Hijacked combo' },
  };
  const res = createMockRes();
  await ctrl.update(req, res);
  assert.equal(res.statusCode, 403);
});

test('unrelated provider cannot read a private partnership', async () => {
  const privateRow = { ...liveRow, is_public: 0 };
  const ctrl = loadWithStubs('../controllers/providerPartnershipController', {
    '../utils/entityAccess': {
      isAdmin: () => false,
      providerIdForUser: async () => 99,
    },
    '../services/providerPartnershipService': {
      PartnershipError: Error,
      decorate: (row) => row,
      publicView: (row) => ({ id: row.id, public: true }),
      getById: async () => privateRow,
      invite: async () => privateRow,
      respond: async () => privateRow,
      updateByLeadOrAdmin: async () => privateRow,
      listForProvider: async () => [],
      listPublicForProvider: async () => [],
      listAll: async () => [],
      isParty: () => false,
    },
    '../services/notificationService': {
      notifyPartnershipInvite: async () => {},
      notifyPartnershipResponse: async () => {},
    },
  });

  const req = { user: { id: 9, role: 'provider' }, params: { id: 3 } };
  const res = createMockRes();
  await ctrl.getOne(req, res);
  assert.equal(res.statusCode, 403);
});

test('invite rejects a provider inviting themselves', async () => {
  const { PartnershipError, invite } = loadWithStubs('../services/providerPartnershipService', {
    '../db/db': { executeSQL: async () => [] },
    '../utils/portfolioImages': { bindJsonDocument: (v) => JSON.stringify(v) },
    '../utils/commission': { getEffectiveCommissionPercent: () => 15 },
  });
  await assert.rejects(
    () => invite(10, { partner_provider_id: 10, accept_contract: true }),
    (err) => err instanceof PartnershipError && /yourself/.test(err.message)
  );
});
