const express = require('express');
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/serviceCategoryController');

const router = express.Router();

// Lecture publique — inchangé (équivaut à createEntityRouter { publicGet: true }).
router.get('/', optionalAuth, ctrl.getAll);
router.get('/:id', optionalAuth, ctrl.getOne);

// BEX-008 : écriture réservée admin. Sans requireRole, tout compte authentifié
// (client compris) pouvait créer / renommer / supprimer les catégories de la marketplace.
router.post('/', authenticate, requireRole('admin'), ctrl.create);
router.put('/:id', authenticate, requireRole('admin'), ctrl.update);
router.delete('/:id', authenticate, requireRole('admin'), ctrl.remove);

module.exports = router;
