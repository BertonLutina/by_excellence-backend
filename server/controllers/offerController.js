const createEntityController = require('./createEntityController');
const Offer = require('../models/Offer');
module.exports = createEntityController(Offer, 'Offer');
