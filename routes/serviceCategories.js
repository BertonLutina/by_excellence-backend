const createEntityRouter = require('./createEntityRouter');
const ctrl = require('../controllers/serviceCategoryController');
module.exports = createEntityRouter(ctrl, { publicGet: true });
