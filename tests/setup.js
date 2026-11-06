// Offline HTTP tests mock only the MongoDB driver boundary. Runtime has no RAM provider.
process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
if (process.env.TEST_MONGODB_URI) {
  if (!process.env.TEST_MONGODB_DB_NAME?.endsWith('_test')) {
    throw new Error('Real integration tests require a dedicated database name ending in _test');
  }
  process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
  process.env.MONGODB_DB_NAME = process.env.TEST_MONGODB_DB_NAME;
} else {
  process.env.MONGODB_URI = 'mongodb://test.invalid';
  process.env.MONGODB_DB_NAME = 'electrohub_test';
  const { mock } = require('node:test');
  const { MongoClient } = require('mongodb');
  const seeds = require('../db/seed-data');
  const tables = structuredClone({ users: seeds.usersTable,
    products: seeds.initialProducts, orders: seeds.ordersTable });
  const matches = (row, filter, options = {}) => Object.entries(filter).every(([k, v]) =>
    options.collation && typeof v === 'string'
      ? String(row[k]).toLowerCase() === v.toLowerCase() : row[k] === v);
  mock.method(MongoClient.prototype, 'connect', async function () { return this; });
  mock.method(MongoClient.prototype, 'db', () => ({
    command: async () => ({ ok: 1 }),
    collection: name => ({
      findOne: async filter => tables[name].find(row => matches(row, filter)) || null,
      find: (filter, options) => ({ toArray: async () => tables[name].filter(row => matches(row, filter, options)) }),
      insertOne: async row => { tables[name].push(structuredClone(row)); return { acknowledged: true }; }
    })
  }));
}
require('node:test').after(async () => require('../db/database').closeDatabase());
