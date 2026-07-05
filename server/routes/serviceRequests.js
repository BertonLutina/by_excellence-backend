const express = require('express');
const { authenticate, optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/serviceRequestController');
const collabCtrl = require('../controllers/serviceRequestCollaboratorController');

const router = express.Router();

router.get('/', authenticate, ctrl.getAll);
router.get('/:id/collaborators', authenticate, collabCtrl.list);
router.post('/:id/collaborators', authenticate, collabCtrl.invite);
router.put('/:id/collaborators/:providerId', authenticate, collabCtrl.respond);
router.delete('/:id/collaborators/:providerId', authenticate, collabCtrl.remove);
router.get('/:id', authenticate, ctrl.getOne);
router.post('/', optionalAuth, ctrl.create);
router.put('/:id', authenticate, ctrl.update);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;
