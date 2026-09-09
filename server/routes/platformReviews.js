const createEntityRouter = require('./createEntityRouter');
const ctrl = require('../controllers/platformReviewController');

module.exports = createEntityRouter(ctrl, { publicGet: true });
