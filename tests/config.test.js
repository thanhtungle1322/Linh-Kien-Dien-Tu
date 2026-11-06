const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

for (const name of ['MYSQL_HOST', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD']) {
  test(`health reports missing ${name} without exposing configuration`, async () => {
    const value = process.env[name];
    delete process.env[name];
    try {
      const response = await request(app).get('/api/health');
      assert.equal(response.status, 503);
      assert.equal(response.body.database.errorCode, name + '_MISSING');
      assert.equal(response.body.database.provider, 'mysql');
    } finally { process.env[name] = value; }
  });
}
test('health classifies SQL failures without leaking SQL or credentials', async t => {
  const mysql = require('mysql2/promise');
  const { closeDatabase } = require('../db/database');
  for (const [code, expected] of [['ER_ACCESS_DENIED_ERROR', 'MYSQL_AUTH_FAILED'],
    ['ER_DBACCESS_DENIED_ERROR', 'MYSQL_PERMISSION_DENIED'], ['ETIMEDOUT', 'MYSQL_NETWORK_FAILED']]) {
    await closeDatabase();
    const stub = t.mock.method(mysql, 'createPool', () => ({
      execute: async () => { throw Object.assign(new Error('sensitive-password-and-query-marker'), { code }); },
      end: async () => {}
    }));
    try {
      const response = await request(app).get('/api/health');
      assert.equal(response.status, 503);
      assert.equal(response.body.database.errorCode, expected);
      assert.ok(!JSON.stringify(response.body).includes('sensitive-password-and-query-marker'));
    } finally { stub.mock.restore(); await closeDatabase(); }
  }
});
test('login rejects objects supplied as credentials', async () => {
  const response = await request(app).post('/api/auth/login')
    .send({ username: { $ne: null }, password: { $ne: null } });
  assert.equal(response.status, 400);
});
