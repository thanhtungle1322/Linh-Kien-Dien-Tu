const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

for (const newline of ['\n', '\r\n']) {
  test(`benchmark applies all five patterns and restores exact baseline (${JSON.stringify(newline)})`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'electrohub-benchmark-'));
    const names = ['auth.js', 'products.js', 'files.js', 'orders.js'];
    const scripts = ['apply-vulnerabilities.js', 'restore-clean.js'];
    const originals = new Map();
    fs.mkdirSync(path.join(root, 'routes'));
    fs.mkdirSync(path.join(root, 'scripts'));
    const run = script => spawnSync(process.execPath, [path.join(root, 'scripts', script)], { encoding: 'utf8' });
    try {
      for (const name of names) {
        const content = fs.readFileSync(path.join(__dirname, '../routes', name), 'utf8').replace(/\r?\n/g, newline);
        originals.set(name, content);
        fs.writeFileSync(path.join(root, 'routes', name), content);
      }
      for (const name of scripts) fs.copyFileSync(path.join(__dirname, '../scripts', name), path.join(root, 'scripts', name));
      assert.equal(run(scripts[0]).status, 0);
      const read = name => fs.readFileSync(path.join(root, 'routes', name), 'utf8');
      const vulnerableAuth = read('auth.js');
      assert.ok(vulnerableAuth.includes("username='${username}'"));
      assert.match(vulnerableAuth, /const JWT_SECRET = 'benchmark_only_/);
      assert.ok(read('products.js').includes('res.send('));
      assert.ok(read('files.js').includes('path.resolve(DATASHEETS_DIR, file)'));
      assert.ok(read('orders.js').includes('router.get("/:id", authenticateToken'));
      assert.ok(read('orders.js').includes('where: { id: Number(req.params.id) }'));
      assert.notEqual(run(scripts[0]).status, 0, 'double apply must fail');
      assert.equal(read('auth.js'), vulnerableAuth);
      assert.equal(run(scripts[1]).status, 0);
      for (const [name, content] of originals) assert.equal(read(name), content);
      fs.writeFileSync(path.join(root, 'routes/products.js'), '// incompatible baseline');
      assert.notEqual(run(scripts[0]).status, 0);
      assert.equal(read('auth.js'), originals.get('auth.js'), 'failed replacement must not partially write');
    } finally {
      // Remove only the exact fixture files created above; no recursive deletion.
      for (const dir of ['routes', 'scripts', '.benchmark-clean']) {
        const directory = path.join(root, dir);
        if (!fs.existsSync(directory)) continue;
        for (const name of dir === 'scripts' ? scripts : names) {
          const target = path.join(directory, name);
          if (fs.existsSync(target)) fs.unlinkSync(target);
        }
        fs.rmdirSync(directory);
      }
      fs.rmdirSync(root);
    }
  });
}
