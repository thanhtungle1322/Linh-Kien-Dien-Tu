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
    assert.equal(JSON.stringify(response.body).includes('mongodb://'), false);
  } finally { process.env.MONGODB_URI = uri; }
});

test('login rejects MongoDB query operators supplied as credentials', async () => {
  const response = await request(app).post('/api/auth/login')
    .send({ username: { $ne: null }, password: { $ne: null } });
  assert.equal(response.status, 400);
});
