const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

test('catalog accepts case-insensitive categories and rejects query operators', async () => {
  const sensors = await request(app).get('/api/products?category=sensors');
  assert.equal(sensors.status, 200);
  assert.equal(sensors.body.products.length, 2);
  const injected = await request(app).get('/api/products?category[$ne]=Sensors');
  assert.equal(injected.status, 400);
});
