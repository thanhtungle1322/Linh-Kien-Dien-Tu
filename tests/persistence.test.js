const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

test('health reports the configured storage and seeded orders stay private', async () => {
  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.database.provider, 'mysql');
  assert.equal(health.body.database.status, 'connected');
  const login = await request(app).post('/api/auth/login')
    .send({ username: 'thanhtung', password: 'Password123!' });
  const token = login.body.token;
  const created = await request(app).post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ items: [{ productId: 1, price: 185000, quantity: 1 }] });
  assert.equal(created.status, 201);
  const own = await request(app).get(`/api/orders/${created.body.order.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(own.status, 200);
  assert.equal(own.body.userId, 2);
  const other = await request(app).get('/api/orders/900875')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(other.status, 403);
});
