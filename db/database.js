const mysql = require('mysql2/promise');
const { randomInt } = require('node:crypto');
let pool;

function getPool() {
  for (const name of ['MYSQL_HOST', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD']) {
    if (!process.env[name]) throw Object.assign(new Error('Missing database configuration'), { code: name + '_MISSING' });
  }
  const port = Number(process.env.MYSQL_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw Object.assign(new Error('Invalid database port'), { code: 'MYSQL_PORT_INVALID' });
  }
  if (!pool) pool = mysql.createPool({
    host: process.env.MYSQL_HOST, port, database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
    ssl: { rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2' },
    connectionLimit: 5, maxIdle: 2, idleTimeout: 60000,
    waitForConnections: true, queueLimit: 20, connectTimeout: 10000,
    enableKeepAlive: true, multipleStatements: false,
    charset: 'utf8mb4', decimalNumbers: true, dateStrings: true
  });
  return pool;
}
function diagnostics(error) {
  const configCodes = new Set(['MYSQL_HOST_MISSING', 'MYSQL_DATABASE_MISSING',
    'MYSQL_USER_MISSING', 'MYSQL_PASSWORD_MISSING', 'MYSQL_PORT_INVALID']);
  const categories = {
    ER_ACCESS_DENIED_ERROR: 'MYSQL_AUTH_FAILED', ER_DBACCESS_DENIED_ERROR: 'MYSQL_PERMISSION_DENIED',
    ER_TABLEACCESS_DENIED_ERROR: 'MYSQL_PERMISSION_DENIED', ER_BAD_DB_ERROR: 'MYSQL_DATABASE_NOT_FOUND',
    ER_NO_SUCH_TABLE: 'MYSQL_SCHEMA_MISSING', ENOTFOUND: 'MYSQL_DNS_FAILED', EAI_AGAIN: 'MYSQL_DNS_FAILED',
    ECONNREFUSED: 'MYSQL_NETWORK_FAILED', ETIMEDOUT: 'MYSQL_NETWORK_FAILED',
    ECONNRESET: 'MYSQL_NETWORK_FAILED', PROTOCOL_CONNECTION_LOST: 'MYSQL_NETWORK_FAILED',
    CERT_HAS_EXPIRED: 'MYSQL_TLS_FAILED', ERR_TLS_CERT_ALTNAME_INVALID: 'MYSQL_TLS_FAILED',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'MYSQL_TLS_FAILED', HANDSHAKE_NO_SSL_SUPPORT: 'MYSQL_TLS_FAILED'
  };
  return { errorCode: configCodes.has(error?.code) ? error.code : categories[error?.code] || 'MYSQL_CONNECTION_FAILED',
    ...(Number.isSafeInteger(error?.errno) ? { driverCode: error.errno } : {}) };
}
const statement = sql => ({ sql, timeout: 10000 });
async function execute(sql, params = []) {
  const [rows] = await getPool().execute(statement(sql), params);
  return rows;
}
async function closeDatabase() {
  const current = pool;
  pool = undefined;
  if (current) await current.end();
}
async function health() {
  await execute('SELECT 1 AS ok');
  return { provider: 'mysql', status: 'connected' };
}

// Bound calls use server-side prepared statements. Raw benchmark calls use the
// real SQL engine with a single statement; no SQL emulation or MongoDB fallback.
const dbConnection = {
  query(sql, paramsOrCallback, callback) {
    const bound = Array.isArray(paramsOrCallback);
    const done = bound ? callback : paramsOrCallback;
    Promise.resolve().then(() => bound ? execute(sql, paramsOrCallback)
      : getPool().query(statement(sql)).then(([rows]) => rows))
      .then(rows => done(null, rows), error => done(error));
  }
};
function orderWhere(where = {}) {
  const clauses = [], params = [];
  for (const key of Object.keys(where)) {
    if (!['id', 'userId'].includes(key)) throw new Error('Unsupported order filter');
    if (!Number.isSafeInteger(where[key])) return { sql: ' WHERE 1 = 0', params: [] };
    clauses.push(key === 'id' ? 'id = ?' : 'userId = ?');
    params.push(where[key]);
  }
  return { sql: clauses.length ? ' WHERE ' + clauses.join(' AND ') : '', params };
}
function hydrateOrder(row) {
  return row ? { ...row, items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items } : null;
}
const db = {
  products: {
    async findAll(category) {
      return !category || category === 'All'
        ? execute('SELECT * FROM electrohub_products ORDER BY id')
        : execute('SELECT * FROM electrohub_products WHERE category = ? ORDER BY id', [category]);
    },
    async findById(id) {
      const value = Number(id);
      if (!Number.isSafeInteger(value)) return null;
      return (await execute('SELECT * FROM electrohub_products WHERE id = ?', [value]))[0] || null;
    }
  },
  orders: {
    async findOne(options = {}) {
      const filter = orderWhere(options.where);
      return hydrateOrder((await execute('SELECT * FROM electrohub_orders' + filter.sql + ' LIMIT 1', filter.params))[0]);
    },
    async findAll(options = {}) {
      const filter = orderWhere(options.where);
      return (await execute('SELECT * FROM electrohub_orders' + filter.sql + ' ORDER BY id', filter.params)).map(hydrateOrder);
    },
    async create(data) {
      const row = { ...data, id: randomInt(1000000, 281474976710655),
        createdAt: new Date().toISOString(), status: 'Đang xử lý' };
      await execute(`INSERT INTO electrohub_orders
        (id, userId, customerName, items, totalAmount, shippingAddress, paymentMethod, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [row.id, row.userId, row.customerName,
        JSON.stringify(row.items), row.totalAmount, row.shippingAddress, row.paymentMethod, row.status, row.createdAt]);
      return row;
    }
  }
};
async function seedDatabase() {
  const schema = require('node:fs').readFileSync(require('node:path').join(__dirname, 'schema.sql'), 'utf8');
  for (const sql of schema.split(';').map(sql => sql.trim()).filter(Boolean)) await execute(sql);
  const { initialProducts, usersTable, ordersTable } = require('./seed-data');
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const groups = [
      ['INSERT INTO electrohub_users (id, username, password, email, role, fullName) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
        ['id', 'username', 'password', 'email', 'role', 'fullName'], usersTable],
      ['INSERT INTO electrohub_products (id, name, category, price, stock, rating, description, datasheet, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
        ['id', 'name', 'category', 'price', 'stock', 'rating', 'description', 'datasheet', 'image'], initialProducts],
      ['INSERT INTO electrohub_orders (id, userId, customerName, items, totalAmount, shippingAddress, paymentMethod, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
        ['id', 'userId', 'customerName', 'items', 'totalAmount', 'shippingAddress', 'paymentMethod', 'status', 'createdAt'], ordersTable]
    ];
    for (const [sql, columns, rows] of groups) {
      for (const row of rows) {
        await connection.execute(statement(sql),
          columns.map(key => key === 'items' ? JSON.stringify(row[key]) : row[key]));
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
module.exports = { db, dbConnection, health, closeDatabase, seedDatabase, diagnostics };
