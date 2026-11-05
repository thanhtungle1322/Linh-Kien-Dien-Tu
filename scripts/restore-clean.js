/**
 * Script to restore the clean, secure code state (Commit 1 baseline).
 */

const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
console.log('🔄 Restoring clean baseline from git...');
execSync('git checkout -- routes/', { cwd: rootDir, stdio: 'inherit' });
console.log('✨ Clean baseline restored successfully!');
