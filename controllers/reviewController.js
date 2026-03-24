const createEntityController = require('./createEntityController');
const Review = require('../models/Review');
module.exports = createEntityController(Review, 'Review');
