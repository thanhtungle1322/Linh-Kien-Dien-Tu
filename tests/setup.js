// Offline tests mock only the MySQL driver. Runtime always uses SQL persistence.
process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
if (process.env.TEST_MYSQL_DATABASE) {
  if (!process.env.TEST_MYSQL_DATABASE.endsWith('_test')) throw new Error('Use a dedicated _test database');
  for (const key of ['HOST', 'PORT', 'DATABASE', 'USER', 'PASSWORD']) {
    if (process.env['TEST_MYSQL_' + key]) process.env['MYSQL_' + key] = process.env['TEST_MYSQL_' + key];
  }
} else {
  Object.assign(process.env, { MYSQL_HOST: 'test.invalid', MYSQL_PORT: '3306',
    MYSQL_DATABASE: 'electrohub_test', MYSQL_USER: 'test', MYSQL_PASSWORD: 'offline-test-only' });
  const mysql = require('mysql2/promise');
  const { mock } = require('node:test');
  const seeds = require('../db/seed-data');
  const tables = structuredClone({ users: seeds.usersTable, products: seeds.initialProducts, orders: seeds.ordersTable });
  mock.method(mysql, 'createPool', () => ({
    async execute(options, params = []) {
      const sql = options.sql.replace(/\s+/g, ' ').trim();
      if (sql === 'SELECT 1 AS ok') return [[{ ok: 1 }], []];
      if (sql.startsWith('SELECT * FROM electrohub_users')) {
        return [tables.users.filter(row => row.username === params[0] && row.password === params[1]), []];
      }
      if (sql.startsWith('SELECT * FROM electrohub_products')) {
        return [tables.products.filter(row => sql.includes('category = ?')
          ? row.category.toLowerCase() === String(params[0]).toLowerCase()
          : !sql.includes('id = ?') || row.id === params[0]), []];
      }
      if (sql.startsWith('SELECT * FROM electrohub_orders')) {
        const rows = tables.orders.filter(row => {
          if (sql.includes('1 = 0')) return false;
          let index = 0;
          return (!sql.includes('id = ?') || row.id === params[index++]) &&
            (!sql.includes('userId = ?') || row.userId === params[index]);
        });
        return [sql.includes('LIMIT 1') ? rows.slice(0, 1) : rows, []];
      }
      if (sql.startsWith('INSERT INTO electrohub_orders')) {
        const keys = ['id', 'userId', 'customerName', 'items', 'totalAmount', 'shippingAddress', 'paymentMethod', 'status', 'createdAt'];
        tables.orders.push(Object.fromEntries(keys.map((key, i) => [key, params[i]])));
        return [{ affectedRows: 1 }, []];
      }
      throw new Error('Unexpected prepared statement in offline fixture');
    },
    async query() { throw new Error('Raw benchmark SQL is not simulated by offline tests'); },
    async end() {}
  }));
}
require('node:test').after(async () => require('../db/database').closeDatabase());
