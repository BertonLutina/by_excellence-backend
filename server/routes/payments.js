const createEntityRouter = require('./createEntityRouter');
const ctrl = require('../controllers/paymentController');
module.exports = createEntityRouter(ctrl);
