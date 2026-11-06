const { spawnSync } = require('node:child_process');
const config = require('dotenv').config({ path: '.env.test', quiet: true, override: true });
if (config.error || !process.env.MONGODB_URI || !process.env.MONGODB_DB_NAME?.endsWith('_test')) {
  console.error('Create .env.test with MONGODB_URI and MONGODB_DB_NAME ending in _test. No mock fallback.');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['--require', './tests/setup.js', '--test', 'tests/*.test.js'], {
  stdio: 'inherit', env: { ...process.env, TEST_MONGODB_URI: process.env.MONGODB_URI,
    TEST_MONGODB_DB_NAME: process.env.MONGODB_DB_NAME }
});
process.exitCode = result.status ?? 1;
