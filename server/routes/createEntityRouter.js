const { authenticate, optionalAuth } = require('../middleware/auth');

/** @param {object} controller - getAll, getOne, create, update, remove
 *  @param {{ publicGet?: boolean }} opts - if true, GET list/one use optionalAuth (for categories, providers)
 */
const createEntityRouter = (controller, opts = {}) => {
  const r = require('express').Router();
  const getAuth = opts.publicGet ? optionalAuth : authenticate;
  r.get('/', getAuth, controller.getAll);
  r.get('/:id', getAuth, controller.getOne);
  r.post('/', authenticate, controller.create);
  r.put('/:id', authenticate, controller.update);
  r.delete('/:id', authenticate, controller.remove);
  return r;
};

module.exports = createEntityRouter;
