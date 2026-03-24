const createEntityController = require('./createEntityController');
const Message = require('../models/Message');
module.exports = createEntityController(Message, 'Message');
