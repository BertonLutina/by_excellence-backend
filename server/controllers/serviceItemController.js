const ServiceItem = require('../models/ServiceItem');
const { getStripe } = require('../utils/stripeClient');
const { providerIdForUser } = require('../utils/entityAccess');

const ITEM_TYPES = new Set(['service', 'package', 'good']);
const GOODS_QUANTITY_FIELDS = ['stock_quantity', 'min_order_quantity'];

async function syncStripeProduct(item) {
  const stripe = getStripe();
  if (!stripe || !item.title || !(Number(item.price) > 0)) return {};

  const priceInCents = Math.round(Number(item.price) * 100);

  let stripeProductId = item.stripe_product_id;
  let stripePriceId = item.stripe_price_id;

  if (!stripeProductId) {
    const product = await stripe.products.create({
      name: item.title,
      description: item.description || undefined,
      metadata: { service_item_id: String(item.id || '') },
    });
    stripeProductId = product.id;
  } else {
    await stripe.products.update(stripeProductId, {
      name: item.title,
      description: item.description || '',
    }).catch(() => {});
  }

  const currentPrice = stripePriceId
    ? await stripe.prices.retrieve(stripePriceId).catch(() => null)
    : null;

  if (!currentPrice || currentPrice.unit_amount !== priceInCents) {
    if (stripePriceId) {
      await stripe.prices.update(stripePriceId, { active: false }).catch(() => {});
    }
    const price = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: priceInCents,
      currency: 'eur',
    });
    stripePriceId = price.id;
  }

  return { stripe_product_id: stripeProductId, stripe_price_id: stripePriceId };
}

function parseIncludes(raw) {
  if (Array.isArray(raw)) return raw.filter((x) => String(x || '').trim() !== '');
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.filter((x) => String(x || '').trim() !== '') : [];
    } catch {
      return [s];
    }
  }
  return [];
}

function serialize(row) {
  if (!row) return row;
  const includes = parseIncludes(row.includes);
  return {
    ...row,
    name: row.title,
    includes,
  };
}

async function currentProviderId(req) {
  if (req?.user?.role !== 'provider') return null;
  return providerIdForUser(req.user.id);
}

function canManageServiceItem(user, item, providerId) {
  if (user?.role === 'admin') return true;
  if (user?.role !== 'provider') return false;
  if (providerId != null && item?.provider_id != null) {
    return Number(item.provider_id) === Number(providerId);
  }
  return item?.created_by != null && user?.id != null && Number(item.created_by) === Number(user.id);
}

function toModelPayload(body = {}, req, forcedProviderId = null) {
  const out = { ...body };

  if (out.name != null && out.title == null) out.title = out.name;
  if (out.title != null) out.title = String(out.title).trim();

  if (!ITEM_TYPES.has(out.item_type)) out.item_type = 'package';

  if (Object.prototype.hasOwnProperty.call(out, 'includes')) {
    out.includes = JSON.stringify(parseIncludes(out.includes));
  }

  if (out.price != null && out.price !== '') {
    const n = Number(out.price);
    if (Number.isFinite(n)) out.price = n;
  }

  if (out.order != null && out.order !== '') {
    const n = parseInt(out.order, 10);
    if (Number.isFinite(n)) out.order = n;
  }

  for (const key of GOODS_QUANTITY_FIELDS) {
    if (out[key] != null && out[key] !== '') {
      const n = parseInt(out[key], 10);
      out[key] = Number.isFinite(n) && n >= 0 ? n : null;
    }
  }

  if (out.unit != null) out.unit = String(out.unit).trim().slice(0, 50);

  if (out.is_active === undefined) out.is_active = 1;
  if (out.created_by === undefined && req?.user?.id != null) out.created_by = req.user.id;
  if (forcedProviderId != null) out.provider_id = forcedProviderId;

  delete out.name;
  return out;
}

module.exports = {
  getAll: async (req, res) => {
    try {
      const { sort, limit, offset, include_total, ...filters } = req.query;
      void include_total;
      const rows = await ServiceItem.findAll({ filters, sort, limit, offset });
      return res.json((rows || []).map(serialize));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  getOne: async (req, res) => {
    try {
      const row = await ServiceItem.findById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      return res.json(serialize(row));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'provider') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const providerId = await currentProviderId(req);
      if (req.user?.role === 'provider' && providerId == null) {
        return res.status(403).json({ error: 'Provider profile required' });
      }
      const payload = toModelPayload(req.body, req, providerId);
      const row = await ServiceItem.create(payload);

      // Sync to Stripe after creation (non-blocking on failure)
      const stripeIds = await syncStripeProduct(row).catch(() => ({}));
      if (stripeIds.stripe_product_id) {
        await ServiceItem.update(row.id, stripeIds).catch(() => {});
        Object.assign(row, stripeIds);
      }

      return res.status(201).json(serialize(row));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const existing = await ServiceItem.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      const providerId = await currentProviderId(req);
      if (!canManageServiceItem(req.user, existing, providerId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const payload = toModelPayload(req.body, req);
      if (req.user?.role === 'provider') delete payload.provider_id;
      const row = await ServiceItem.update(req.params.id, payload);
      if (!row) return res.status(404).json({ error: 'Not found' });

      // Sync to Stripe after update (non-blocking on failure)
      const stripeIds = await syncStripeProduct(row).catch(() => ({}));
      if (stripeIds.stripe_product_id) {
        await ServiceItem.update(row.id, stripeIds).catch(() => {});
        Object.assign(row, stripeIds);
      }

      return res.json(serialize(row));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const existing = await ServiceItem.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      const providerId = await currentProviderId(req);
      if (!canManageServiceItem(req.user, existing, providerId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (existing?.stripe_product_id) {
        const stripe = getStripe();
        if (stripe) {
          await stripe.products.update(existing.stripe_product_id, { active: false }).catch(() => {});
        }
      }
      await ServiceItem.delete(req.params.id);
      return res.json({ success: true, id: req.params.id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};
