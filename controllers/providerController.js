const createEntityController = require('./createEntityController');
const Provider = require('../models/Provider');
module.exports = createEntityController(Provider, 'Provider');
