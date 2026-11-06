require('dotenv').config();
const { seedDatabase, closeDatabase } = require('../db/database');
(async () => {
  try {
    await seedDatabase();
    console.log('Seed complete: 3 users, 8 products, 4 orders (existing records preserved).');
  } catch (error) {
    console.error('Seed failed:', require('../db/database').diagnostics(error));
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
})();
