const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

test('MongoDB configuration is mandatory; health returns 503 without URI', async () => {
  const uri = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;
  try {
    const response = await request(app).get('/api/health');
    assert.equal(response.status, 503);
    assert.equal(response.body.database.status, 'unavailable');
    assert.equal(response.body.database.errorCode, 'MONGODB_URI_MISSING');
    assert.equal(JSON.stringify(response.body).includes('mongodb://'), false);
  } finally { process.env.MONGODB_URI = uri; }
});

test('health identifies missing database name without exposing configuration', async () => {
  const name = process.env.MONGODB_DB_NAME;
  delete process.env.MONGODB_DB_NAME;
  try {
    const response = await request(app).get('/api/health');
    assert.equal(response.status, 503);
    assert.equal(response.body.database.errorCode, 'MONGODB_DB_NAME_MISSING');
  } finally { process.env.MONGODB_DB_NAME = name; }
});

test('health distinguishes authentication and network failures without leaking driver messages', async t => {
  const { MongoClient } = require('mongodb');
  const { closeDatabase } = require('../db/database');
  for (const [error, expected] of [
    [Object.assign(new Error('sensitive-uri-marker'), { code: 18 }), 'MONGODB_AUTH_FAILED'],
    [Object.assign(new Error('bad auth : authentication failed; sensitive-uri-marker'), { name: 'MongoServerError', code: 8000 }), 'MONGODB_AUTH_FAILED'],
    [Object.assign(new Error('sensitive-uri-marker'), { code: 13 }), 'MONGODB_PERMISSION_DENIED'],
    [Object.assign(new Error('sensitive-uri-marker'), { name: 'MongoServerSelectionError' }), 'MONGODB_NETWORK_FAILED']
  ]) {
    await closeDatabase();
    const stub = t.mock.method(MongoClient.prototype, 'connect', async () => { throw error; });
    try {
      const response = await request(app).get('/api/health');
      assert.equal(response.status, 503);
      assert.equal(response.body.database.errorCode, expected);
      assert.ok(!JSON.stringify(response.body).includes('sensitive-uri-marker'));
      if (error.code === 8000) {
        assert.equal(response.body.database.driverName, 'MongoServerError');
        assert.equal(response.body.database.driverCode, 8000);
      }
    } finally { stub.mock.restore(); await closeDatabase(); }
  }
});

test('login rejects MongoDB query operators supplied as credentials', async () => {
  const response = await request(app).post('/api/auth/login')
    .send({ username: { $ne: null }, password: { $ne: null } });
  assert.equal(response.status, 400);
});
