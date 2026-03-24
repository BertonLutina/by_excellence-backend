const createEntityRouter = require('./createEntityRouter');
const ctrl = require('../controllers/serviceRequestController');
module.exports = createEntityRouter(ctrl);
