'use strict';

/**
 * Inscription publique : le rôle choisi par le navigateur ne doit jamais
 * pouvoir créer un compte administrateur.
 *
 * Convention : on appelle le contrôleur directement avec un req/res simulé,
 * les modèles et l'envoi d'e-mail sont remplacés avant le require du contrôleur.
 */

process.env.JWT_SECRET = 'test-secret-for-register-role';

const test = require('node:test');
const assert = require('node:assert/strict');

const mailer = require('../utils/mailer');
mailer.sendMail = async () => ({});

const User = require('../models/User');
const created = [];
User.findByEmail = async () => null;
User.create = async (data) => {
  created.push(data);
  return { id: 7, ...data, verification_token: 'token' };
};

const { register } = require('../controllers/authController');

const createMockRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
};

async function signUp(body) {
  created.length = 0;
  const res = createMockRes();
  await register({ body: { email: 'new@example.com', password: 'motdepasse1', full_name: 'Test', ...body } }, res);
  return res;
}

test('role "admin" demandé à l\'inscription : le compte créé est client', async () => {
  const res = await signUp({ role: 'admin' });
  assert.equal(res.statusCode, 201);
  assert.equal(created[0].role, 'client');
  assert.equal(res.body.user.role, 'client');
});

test('role numérique 3 (admin) : le compte créé est client', async () => {
  const res = await signUp({ role: 3 });
  assert.equal(res.statusCode, 201);
  assert.equal(created[0].role, 'client');
});

test('role en tableau ou en objet : le compte créé est client', async () => {
  await signUp({ role: ['admin'] });
  assert.equal(created[0].role, 'client');
  await signUp({ role: { toString: () => 'admin' } });
  assert.equal(created[0].role, 'client');
});

test('role "provider" : le compte prestataire est conservé', async () => {
  const res = await signUp({ role: 'provider' });
  assert.equal(res.statusCode, 201);
  assert.equal(created[0].role, 'provider');
  assert.equal(res.body.user.role, 'provider');
});

test('role "client" ou absent : le compte créé est client', async () => {
  await signUp({ role: 'client' });
  assert.equal(created[0].role, 'client');
  await signUp({});
  assert.equal(created[0].role, 'client');
});

test('e-mail ou mot de passe manquant : 400, aucun compte créé', async () => {
  created.length = 0;
  const res = createMockRes();
  await register({ body: { email: 'new@example.com' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(created.length, 0);
});
