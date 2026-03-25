const createEntityController = require('./createEntityController');
const ServiceCategory = require('../models/ServiceCategory');
module.exports = createEntityController(ServiceCategory, 'ServiceCategory');
