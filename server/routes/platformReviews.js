const createEntityRouter = require('./createEntityRouter');
const createEntityController = require('../controllers/createEntityController');
const PlatformReview = require('../models/PlatformReview');

module.exports = createEntityRouter(createEntityController(PlatformReview, 'PlatformReview'), { publicGet: true });
