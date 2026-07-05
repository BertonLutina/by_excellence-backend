const ServiceItem = require('../models/ServiceItem');
const { getStripe } = require('../utils/stripeClient');

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

function toModelPayload(body = {}, req) {
  const out = { ...body };

  if (out.name != null && out.title == null) out.title = out.name;
  if (out.title != null) out.title = String(out.title).trim();

  if (out.item_type !== 'service') out.item_type = 'package';

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

  if (out.is_active === undefined) out.is_active = 1;
  if (out.created_by === undefined && req?.user?.id != null) out.created_by = req.user.id;

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
      const payload = toModelPayload(req.body, req);
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
      const payload = toModelPayload(req.body, req);
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
