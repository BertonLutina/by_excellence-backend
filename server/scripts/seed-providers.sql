-- Seed 10 providers. Run after schema: mysql by_excellence < scripts/seed-providers.sql
-- Or paste into MySQL client. Uses UUID() for id and NOW() for dates.

INSERT INTO `providers` (
  `id`, `display_name`, `profession`, `bio`, `city`, `price_from`, `status`, `is_verified`, `rating`, `review_count`, `created_date`, `updated_date`
) VALUES
(UUID(), 'Sophie Laurent', 'Organisatrice d''événements & Décoration', 'Spécialiste en décoration florale et coordination de mariages. Plus de 10 ans d''expérience.', 'Paris', 1500.00, 'active', 1, 4.9, 127, NOW(), NOW()),
(UUID(), 'Amadou Diallo', 'Traiteur & Cuisine africaine', 'Chef traiteur, cuisine fusion africaine et européenne pour vos événements corporatifs et privés.', 'Lyon', 85.00, 'active', 1, 4.8, 64, NOW(), NOW()),
(UUID(), 'Fatou Ndiaye', 'Coordinatrice de mariages', 'Coordination complète du jour J : logistique, fournisseurs et sérénité garantie.', 'Bordeaux', 1200.00, 'active', 1, 5.0, 43, NOW(), NOW()),
(UUID(), 'Jean-Pierre Okemba', 'DJ & Animation musicale', 'DJ professionnel, ambiance afro, coupé-décalé, rnb et variété pour vos soirées.', 'Marseille', 600.00, 'active', 0, 4.6, 28, NOW(), NOW()),
(UUID(), 'Aïssatou Bah', 'Photographe & Vidéaste', 'Reportage photo et vidéo mariages et événements. Style naturel et émotions.', 'Toulouse', 900.00, 'active', 1, 4.9, 56, NOW(), NOW()),
(UUID(), 'Moussa Koné', 'Fleuriste événementiel', 'Créations florales sur mesure : centres de table, arches, bouquets et décoration végétale.', 'Lille', 400.00, 'active', 1, 4.7, 39, NOW(), NOW()),
(UUID(), 'Marie-Claire Sarr', 'Régisseuse & Location matériel', 'Location de chaises, tables, barnum, sono et éclairage pour tous types d''événements.', 'Nantes', 200.00, 'active', 0, 4.5, 22, NOW(), NOW()),
(UUID(), 'Ibrahim Sow', 'Traiteur & Buffet cocktail', 'Buffets cocktail et repas assis. Spécialités sénégalaises et plats du monde.', 'Strasbourg', 45.00, 'active', 1, 4.8, 71, NOW(), NOW()),
(UUID(), 'Émilie Traoré', 'Maquillage & Coiffure mariage', 'Maquillage et coiffure pour mariées et invitées. Essais et jour J.', 'Montpellier', 350.00, 'active', 1, 5.0, 89, NOW(), NOW()),
(UUID(), 'Ousmane Camara', 'Animation & Modération', 'Animateur et modérateur pour séminaires, lancements produit et soirées d''entreprise.', 'Paris', 800.00, 'active', 1, 4.7, 34, NOW(), NOW());
