let client;
let connecting;

const failureCodes = new Set(['MONGODB_URI_MISSING', 'MONGODB_DB_NAME_MISSING',
  'MONGODB_URI_INVALID', 'MONGODB_AUTH_FAILED', 'MONGODB_PERMISSION_DENIED',
  'MONGODB_DNS_FAILED', 'MONGODB_NETWORK_FAILED', 'MONGODB_CONNECTION_FAILED']);
function failureCode(error) {
  if (failureCodes.has(error?.code)) return error.code;
  if (error?.code === 18) return 'MONGODB_AUTH_FAILED';
  if (error?.code === 13) return 'MONGODB_PERMISSION_DENIED';
  if (error?.name === 'MongoParseError' || error?.name === 'MongoInvalidArgumentError') return 'MONGODB_URI_INVALID';
  if (['ENOTFOUND', 'EAI_AGAIN', 'ESERVFAIL', 'ECONNREFUSED'].includes(error?.code) &&
      String(error?.syscall || '').includes('query')) return 'MONGODB_DNS_FAILED';
  if (['MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError'].includes(error?.name)) {
    return 'MONGODB_NETWORK_FAILED';
  }
  return 'MONGODB_CONNECTION_FAILED';
}

async function getDatabase() {
  if (!process.env.MONGODB_URI) throw Object.assign(new Error('Set MONGODB_URI'), { code: 'MONGODB_URI_MISSING' });
  if (!process.env.MONGODB_DB_NAME) throw Object.assign(new Error('Set MONGODB_DB_NAME'), { code: 'MONGODB_DB_NAME_MISSING' });
  if (!connecting) {
    const { MongoClient } = require('mongodb');
    client = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 5, serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000, socketTimeoutMS: 5000
    });
    const current = client;
    connecting = current.connect().then(() => current.db(process.env.MONGODB_DB_NAME))
      .catch(async error => {
        connecting = undefined;
        await current.close().catch(() => {});
        throw Object.assign(new Error('MongoDB connection failed'), { code: failureCode(error) });
      });
  }
  return connecting;
}
async function closeDatabase() {
  if (client) await client.close();
  client = undefined;
  connecting = undefined;
}
async function health() {
  await (await getDatabase()).command({ ping: 1 });
  return { provider: 'mongodb', status: 'connected' };
}
async function collection(name) {
  return (await getDatabase()).collection(name);
}
const projection = { _id: 0 };
const db = {
  users: {
    async findOne(options = {}) {
      return (await collection('users')).findOne(options.where || {}, { projection });
    }
  },
  products: {
    async findAll(category) {
      const filter = !category || category === 'All' ? {} : { category };
      return (await collection('products')).find(filter, {
        projection, collation: { locale: 'en', strength: 2 }
      }).toArray();
    },
    async findById(id) {
      return (await collection('products')).findOne({ id: Number(id) }, { projection });
    }
  },
  orders: {
    async findOne(options = {}) {
      return (await collection('orders')).findOne(options.where || {}, { projection });
    },
    async findAll(options = {}) {
      return (await collection('orders')).find(options.where || {}, { projection }).toArray();
    },
    async create(data) {
      const { randomInt } = require('node:crypto');
      const order = { ...data, id: randomInt(1000000, 281474976710655),
        createdAt: new Date().toISOString(), status: 'Đang xử lý' };
      await (await collection('orders')).insertOne({ ...order });
      return order;
    }
  }
};

// Compatibility seam for the static CWE-89 benchmark. MongoDB never executes SQL.
const dbConnection = {
  query(sql, params, callback) {
    if (typeof params === 'function') {
      return params(new Error('Raw SQL is unavailable with MongoDB; static benchmark only'));
    }
    if (!Array.isArray(params) || params.length !== 2 || params.some(v => typeof v !== 'string')) {
      return callback(new Error('Login requires string credentials'));
    }
    db.users.findOne({ where: { username: params[0], password: params[1] } })
      .then(user => callback(null, user ? [user] : []), error => callback(error));
  }
};
async function seedDatabase() {
  const { initialProducts, usersTable, ordersTable } = require('./seed-data');
  const database = await getDatabase();
  for (const [name, rows] of Object.entries({ users: usersTable, products: initialProducts, orders: ordersTable })) {
    const target = database.collection(name);
    await target.createIndex({ id: 1 }, { unique: true });
    if (name === 'users') await target.createIndex({ username: 1 }, { unique: true });
    if (name === 'orders') await target.createIndex({ userId: 1 });
    await target.bulkWrite(rows.map(row => ({ updateOne: {
      filter: { id: row.id }, update: { $setOnInsert: row }, upsert: true
    } })));
  }
}
module.exports = { db, dbConnection, health, closeDatabase, seedDatabase, failureCode };
