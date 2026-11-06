require('dotenv').config();
const { seedDatabase, closeDatabase } = require('../db/database');
(async () => {
  try {
    await seedDatabase();
    console.log('Seed complete: 3 users, 8 products, 4 orders (existing records preserved).');
  } catch {
    console.error('Seed failed. Check MONGODB_URI, MONGODB_DB_NAME, permissions and Atlas network access.');
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
})();
