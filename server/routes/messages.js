const createEntityRouter = require('./createEntityRouter');
const ctrl = require('../controllers/messageController');
module.exports = createEntityRouter(ctrl);
