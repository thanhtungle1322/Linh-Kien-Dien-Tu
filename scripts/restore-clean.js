const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const backup = path.join(root, '.benchmark-clean');
const names = ['auth.js', 'products.js', 'files.js', 'orders.js'];
// Read all backups first; never silently restore the current Git HEAD.
const originals = names.map(name => [name, fs.readFileSync(path.join(backup, name))]);
for (const [name, data] of originals) fs.writeFileSync(path.join(root, 'routes', name), data);
for (const [name] of originals) fs.unlinkSync(path.join(backup, name));
fs.rmdirSync(backup);
console.log('Restored the saved clean baseline.');
