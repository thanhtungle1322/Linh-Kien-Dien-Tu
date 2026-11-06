const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mysql = require('mysql2/promise');
const database = require('../db/database');
const app = require('../app');

test('HTTP readiness uses the configured MySQL pool over TLS', async t => {
  await database.closeDatabase();
  let options;
  const original = mysql.createPool;
  t.mock.method(mysql, 'createPool', config => { options = config; return original(config); });
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.database.provider, 'mysql');
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.verifyIdentity, true);
  assert.equal(options.multipleStatements, false);
});

test('bound login queries use prepared statements and raw benchmark SQL uses query', async t => {
  await database.closeDatabase();
  const calls = [];
  t.mock.method(mysql, 'createPool', () => ({
    execute: async (options, params) => { calls.push({ kind: 'prepared', sql: options.sql, params }); return [[], []]; },
    query: async options => { calls.push({ kind: 'raw', sql: options.sql }); return [[], []]; },
    end: async () => {}
  }));
  const run = (...args) => new Promise((resolve, reject) => database.dbConnection.query(...args,
    (err, rows) => err ? reject(err) : resolve(rows)));
  await run('SELECT * FROM electrohub_users WHERE username = ? AND password = ?', ['test', "' OR 1=1 -- "]);
  await run('SELECT 1 AS ok');
  assert.equal(calls[0].kind, 'prepared');
  assert.deepEqual(calls[0].params, ['test', "' OR 1=1 -- "]);
  assert.equal(calls[1].kind, 'raw');
  await database.closeDatabase();
});
