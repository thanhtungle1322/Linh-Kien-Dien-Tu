const { spawnSync } = require('node:child_process');
const config = require('dotenv').config({ path: '.env.test', quiet: true, override: true });
if (config.error || !process.env.MYSQL_HOST || !process.env.MYSQL_USER ||
    !process.env.MYSQL_PASSWORD || !process.env.MYSQL_DATABASE?.endsWith('_test')) {
  console.error('Create .env.test with MySQL settings and a database ending in _test. No mock fallback.');
  process.exit(1);
}
const env = { ...process.env };
for (const key of ['HOST', 'PORT', 'DATABASE', 'USER', 'PASSWORD']) {
  if (env['MYSQL_' + key]) env['TEST_MYSQL_' + key] = env['MYSQL_' + key];
}
const result = spawnSync(process.execPath, ['--require', './tests/setup.js', '--test', 'tests/*.test.js'], {
  stdio: 'inherit', env
});
process.exitCode = result.status ?? 1;
