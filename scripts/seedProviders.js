/**
 * Seed 10 providers.
 * Run from backend: node scripts/seedProviders.js
 * Prerequisites: DB created, schema applied (mysql by_excellence < config/schema.sql), .env configured.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const Provider = require('../models/Provider');
const db = require('../config/db');

const providers = [
  { display_name: 'Sophie Laurent', profession: 'Organisatrice d\'événements & Décoration', bio: 'Spécialiste en décoration florale et coordination de mariages. Plus de 10 ans d\'expérience.', city: 'Paris', price_from: 1500, status: 'active', is_verified: 1, rating: 4.9, review_count: 127 },
  { display_name: 'Amadou Diallo', profession: 'Traiteur & Cuisine africaine', bio: 'Chef traiteur, cuisine fusion africaine et européenne pour vos événements corporatifs et privés.', city: 'Lyon', price_from: 85, status: 'active', is_verified: 1, rating: 4.8, review_count: 64 },
  { display_name: 'Fatou Ndiaye', profession: 'Coordinatrice de mariages', bio: 'Coordination complète du jour J : logistique, fournisseurs et sérénité garantie.', city: 'Bordeaux', price_from: 1200, status: 'active', is_verified: 1, rating: 5.0, review_count: 43 },
  { display_name: 'Jean-Pierre Okemba', profession: 'DJ & Animation musicale', bio: 'DJ professionnel, ambiance afro, coupé-décalé, rnb et variété pour vos soirées.', city: 'Marseille', price_from: 600, status: 'active', is_verified: 0, rating: 4.6, review_count: 28 },
  { display_name: 'Aïssatou Bah', profession: 'Photographe & Vidéaste', bio: 'Reportage photo et vidéo mariages et événements. Style naturel et émotions.', city: 'Toulouse', price_from: 900, status: 'active', is_verified: 1, rating: 4.9, review_count: 56 },
  { display_name: 'Moussa Koné', profession: 'Fleuriste événementiel', bio: 'Créations florales sur mesure : centres de table, arches, bouquets et décoration végétale.', city: 'Lille', price_from: 400, status: 'active', is_verified: 1, rating: 4.7, review_count: 39 },
  { display_name: 'Marie-Claire Sarr', profession: 'Régisseuse & Location matériel', bio: 'Location de chaises, tables, barnum, sono et éclairage pour tous types d\'événements.', city: 'Nantes', price_from: 200, status: 'active', is_verified: 0, rating: 4.5, review_count: 22 },
  { display_name: 'Ibrahim Sow', profession: 'Traiteur & Buffet cocktail', bio: 'Buffets cocktail et repas assis. Spécialités sénégalaises et plats du monde.', city: 'Strasbourg', price_from: 45, status: 'active', is_verified: 1, rating: 4.8, review_count: 71 },
  { display_name: 'Émilie Traoré', profession: 'Maquillage & Coiffure mariage', bio: 'Maquillage et coiffure pour mariées et invitées. Essais et jour J.', city: 'Montpellier', price_from: 350, status: 'active', is_verified: 1, rating: 5.0, review_count: 89 },
  { display_name: 'Ousmane Camara', profession: 'Animation & Modération', bio: 'Animateur et modérateur pour séminaires, lancements produit et soirées d\'entreprise.', city: 'Paris', price_from: 800, status: 'active', is_verified: 1, rating: 4.7, review_count: 34 },
];

async function run() {
  try {
    let categoryId = null;
    try {
      const [categories] = await db.execute('SELECT id FROM service_categories LIMIT 1');
      if (categories && categories[0]) categoryId = categories[0].id;
    } catch {
      // service_categories may not exist yet; providers will have category_id null
    }

    for (let i = 0; i < providers.length; i++) {
      const data = { ...providers[i] };
      if (categoryId) data.category_id = categoryId;
      const created = await Provider.create(data);
      console.log(`Created provider ${i + 1}/10: ${created.display_name} (${created.id})`);
    }
    console.log('Done. 10 providers created.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

run();
