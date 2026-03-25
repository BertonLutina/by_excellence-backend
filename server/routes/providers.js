const createEntityRouter = require('./createEntityRouter');
const ctrl = require('../controllers/providerController');
module.exports = createEntityRouter(ctrl, { publicGet: true });
