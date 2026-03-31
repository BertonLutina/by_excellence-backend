/**
 * One provider user per row in service_categories (after seed-service-categories.sql).
 * Inserts users with role provider (trigger creates providers row), then updates profile:
 * category_id, pricing, tier (standard if price_from <= 1000, premium if > 1000).
 *
 * Run: node server/scripts/seedProvidersByCategory.js
 * Prerequisites: DB, schema, service_categories populated, .env
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Provider = require('../models/Provider');
const { executeSQL } = require('../db/db');
const { computeProviderTier } = require('../utils/providerTier');

const FIRST_NAMES = [
  'Sophie', 'Lucas', 'Amélie', 'Thomas', 'Fatou', 'Hugo', 'Inès', 'Nicolas', 'Aïcha', 'Julien',
  'Camille', 'Antoine', 'Léa', 'Pierre', 'Yasmine', 'Marc', 'Élodie', 'David', 'Sarah', 'Rémi',
  'Nora', 'Vincent', 'Chloé', 'Alexandre', 'Mariam', 'Paul', 'Julie', 'Sébastien', 'Zahra', 'Matthieu',
  'Emma', 'Florian', 'Laura', 'Guillaume', 'Hannah', 'Olivier', 'Manon', 'Romain', 'Imane', 'Fabien',
  'Clara', 'Jérôme', 'Anaïs', 'Baptiste', 'Nadia',
];

const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau',
  'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier',
  'Girard', 'Bonnet', 'Dupont', 'Lambert', 'Fontaine', 'Rousseau', 'Vincent', 'Muller', 'Faure', 'André',
  'Mercier', 'Blanc', 'Guérin', 'Boyer', 'Garnier', 'Fabre', 'Louis', 'Martinez', 'Dupuis', 'Brun',
];

const CITIES = [
  'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux',
  'Lille', 'Rennes', 'Reims', 'Le Havre', 'Saint-Étienne', 'Toulon', 'Grenoble', 'Dijon', 'Angers',
  'Nîmes', 'Clermont-Ferrand', 'Aix-en-Provence', 'Brest', 'Tours', 'Limoges', 'Amiens', 'Perpignan',
  'Metz', 'Besançon', 'Orléans', 'Mulhouse', 'Rouen', 'Caen', 'Nancy', 'Saint-Denis', 'Argenteuil',
];

function priceForIndex(i) {
  if (i % 2 === 0) {
    return Number((45 + ((i * 19) % 955)).toFixed(2));
  }
  return Number((1001 + ((i * 47) % 8990)).toFixed(2));
}

function ratingForIndex(i) {
  return Number((4.1 + (i % 9) * 0.09).toFixed(2));
}

function reviewCountForIndex(i) {
  return 12 + (i * 13) % 180;
}

async function ensureProviderForCategory(cat, i, password_hash) {
  const email = `seed.category.${cat.id}@by-excellence.seed`;
  const full_name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 3) % LAST_NAMES.length]}`;
  const price_from = priceForIndex(i);
  const provider_tier = computeProviderTier(price_from);

  let user = await User.findByEmail(email);
  if (!user) {
    user = await User.create({
      email,
      password_hash,
      full_name,
      role: 'provider',
    });
  }

  const providerRow = await Provider.findByUserId(user.id);
  if (!providerRow) {
    throw new Error(`No provider row for user ${user.id} (email ${email})`);
  }

  const bio = `${cat.description} · Prestations sur mesure et suivi personnalisé.`;

  const updated = await Provider.update(providerRow.id, {
    display_name: full_name,
    profession: cat.name.slice(0, 150),
    bio: bio.slice(0, 5000),
    city: CITIES[i % CITIES.length],
    category_id: cat.id,
    price_from,
    provider_tier,
    status: 'active',
    is_verified: 1,
    rating: ratingForIndex(i),
    review_count: reviewCountForIndex(i),
  });

  return updated;
}

async function run() {
  const categories = await executeSQL(
    'SELECT id, name, description FROM service_categories ORDER BY id ASC'
  );
  const rows = Array.isArray(categories) ? categories : [];
  if (rows.length === 0) {
    console.error('No service_categories found. Run seed-service-categories.sql first.');
    process.exit(1);
  }

  const password_hash = await bcrypt.hash('SeedProvider2026!', 10);
  let ok = 0;
  for (let i = 0; i < rows.length; i++) {
    const cat = rows[i];
    const desc = cat.description || cat.name;
    const row = await ensureProviderForCategory({ ...cat, description: desc }, i, password_hash);
    const tier = row.provider_tier || computeProviderTier(row.price_from);
    console.log(`${i + 1}/${rows.length} ${cat.name} → provider #${row.id} (${tier}, ${row.price_from}€)`);
    ok += 1;
  }

  console.log(`Done. ${ok} provider(s) linked to categories.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('seedProvidersByCategory failed:', err.message);
  process.exit(1);
});
