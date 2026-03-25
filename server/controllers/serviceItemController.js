const createEntityController = require('./createEntityController');
const ServiceItem = require('../models/ServiceItem');
module.exports = createEntityController(ServiceItem, 'ServiceItem');
