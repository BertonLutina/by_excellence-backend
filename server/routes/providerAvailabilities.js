const createEntityRouter = require('./createEntityRouter');
const ctrl = require('../controllers/providerAvailabilityController');
module.exports = createEntityRouter(ctrl);
