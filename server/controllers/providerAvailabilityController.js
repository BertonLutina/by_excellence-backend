const createEntityController = require('./createEntityController');
const ProviderAvailability = require('../models/ProviderAvailability');
module.exports = createEntityController(ProviderAvailability, 'ProviderAvailability');
