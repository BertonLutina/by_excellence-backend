const createEntityController = require('./createEntityController');
const Favorite = require('../models/Favorite');
module.exports = createEntityController(Favorite, 'Favorite');
