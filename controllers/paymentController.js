const createEntityController = require('./createEntityController');
const Payment = require('../models/Payment');
module.exports = createEntityController(Payment, 'Payment');
