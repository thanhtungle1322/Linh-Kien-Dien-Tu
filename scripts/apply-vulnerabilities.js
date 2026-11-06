/**
 * Script to automatically apply the 5 ACVIS benchmark vulnerabilities
 * for Commit 2 testing.
 * 
 * Rules applied:
 * 1. CWE-89  (cn_664): SQL injection via string interpolation in auth.js
 * 2. CWE-798 (gen_secret_javascript_5160): Synthetic hardcoded JWT secret in auth.js
 * 3. CWE-79  (javascript_express_js_refund_00009): Reflected XSS in products.js
 * 4. CWE-22  (javascript_express_js_warehouse_00061): Path traversal in files.js
 * 5. CWE-639 (gen_idor_javascript_2896): IDOR in orders.js
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const backupDir = path.join(rootDir, '.benchmark-clean');
if (fs.existsSync(backupDir)) throw new Error('Restore the existing benchmark before applying again');
const files = ['auth.js', 'products.js', 'files.js', 'orders.js'];
const originals = new Map(files.map(name => {
  const target = path.join(rootDir, 'routes', name);
  return [target, fs.readFileSync(target, 'utf8')];
}));
const changes = new Map();
function replaceOnce(source, before, after) {
  if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) {
    throw new Error('Expected exactly one clean benchmark block; no files changed');
  }
  return source.replace(before, after);
}


console.log('🔄 Applying 5 ACVIS vulnerabilities for Commit 2...');

// 1 & 5: auth.js -> CWE-89 & CWE-798
const authPath = path.join(rootDir, 'routes', 'auth.js');
let authContent = fs.readFileSync(authPath, 'utf8').replace(/\r\n/g, '\n');

// Replace JWT_SECRET with a synthetic benchmark secret (CWE-798).
authContent = replaceOnce(authContent,
  "const JWT_SECRET = require('../config/auth').secret;",
  "const JWT_SECRET = 'benchmark_only_7K2m9Q4v6R8x1P3a5N0c';\nrequire('../config/auth').secret = JWT_SECRET;"
);

// Replace parameterized query with string interpolation (CWE-89: cn_664)
const safeAuthBlock = `  // CLEAN BENCHMARK: Placeholders map to validated MongoDB query objects.
  const query = "SELECT * FROM users WHERE username = ? AND password = ?";

  dbConnection.query(query, [username, password], (err, results) => {`;

const vulnAuthBlock = `  // VULNERABLE: Direct string interpolation into SQL query (CWE-89 / cn_664)
  let query = \`SELECT * FROM users WHERE username='\${username}' AND password='\${password}'\`;

  dbConnection.query(query, (err, results) => {`;

authContent = replaceOnce(authContent, safeAuthBlock, vulnAuthBlock);
changes.set(authPath, authContent);

// 2: products.js -> CWE-79 (javascript_express_js_refund_00009)
const productsPath = path.join(rootDir, 'routes', 'products.js');
let productsContent = fs.readFileSync(productsPath, 'utf8').replace(/\r\n/g, '\n');

const safeProductsBlock = `router.get("/preview/echo", (req, res) => {
  const desc = escapeHtml(req.query.name || "");

  // SECURE: Properly sanitized, escaped, and returned as application/json
  res.json({
    status: "success",
    name: desc,
    previewHtml: \`<div class="product-preview"><p>\${desc}</p></div>\`,
    sanitized: true,
    timestamp: new Date().toISOString()
  });
});`;

const vulnProductsBlock = `router.get("/preview/echo", (req, res) => {
  const desc = req.query.name;
  res.send(\`<div class="refund-detail"><p>\${desc}</p></div>\`);
});`;

productsContent = replaceOnce(productsContent, safeProductsBlock, vulnProductsBlock);
changes.set(productsPath, productsContent);

// 3: files.js -> CWE-22 (javascript_express_js_warehouse_00061)
const filesPath = path.join(rootDir, 'routes', 'files.js');
let filesContent = fs.readFileSync(filesPath, 'utf8').replace(/\r\n/g, '\n');

const safeFilesBlock = `router.get("/download", (req, res) => {
  const fileParam = req.query.file;

  if (!fileParam) {
    return res.status(400).json({ error: "Missing required 'file' query parameter" });
  }

  // SECURE: Strip directory components using path.basename
  const safeFilename = path.basename(fileParam);
  const fullPath = path.resolve(DATASHEETS_DIR, safeFilename);

  // SECURE: Whitelist verification and directory boundary check
  if (!fullPath.startsWith(DATASHEETS_DIR)) {
    return res.status(403).send("Forbidden: Directory traversal attempt detected");
  }

  // Check if target datasheet exists
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: \`Datasheet '\${safeFilename}' không tồn tại trên hệ thống\` });
  }

  // Safe file delivery
  res.sendFile(fullPath);
});`;

const vulnFilesBlock = `router.get("/download", (req, res) => {
  const file = req.query.file;
  res.sendFile(path.resolve(DATASHEETS_DIR, file));
});`;

filesContent = replaceOnce(filesContent, safeFilesBlock, vulnFilesBlock);
changes.set(filesPath, filesContent);

// 4: orders.js -> CWE-639 (gen_idor_javascript_2896)
const ordersPath = path.join(rootDir, 'routes', 'orders.js');
let ordersContent = fs.readFileSync(ordersPath, 'utf8').replace(/\r\n/g, '\n');

const safeOrdersBlock = `router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    // SECURE: Query scopes order by both ID and authenticated userId (CWE-639 mitigation)
    // If user is admin, allow viewing any order; otherwise enforce strict ownership
    const queryOptions = req.user.role === "admin"
      ? { where: { id: orderId } }
      : { where: { id: orderId, userId: req.user.id } };

    const data = await db.orders.findOne(queryOptions);

    if (!data) {
      return res.status(403).json({ error: "Access denied: Bạn không có quyền truy cập đơn hàng này" });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi truy vấn thông tin đơn hàng" });
  }
});`;

const vulnOrdersBlock = `// IDOR Vulnerability in Node.js [900875]
router.get("/:id", authenticateToken, async (req, res, next) => {
  try {
    const data = await db.orders.findOne({ where: { id: Number(req.params.id) } });
    if (!data) return res.status(404).json({ error: "Order not found" });
    res.json(data);
  } catch (error) { next(error); }
});`;

ordersContent = replaceOnce(ordersContent, safeOrdersBlock, vulnOrdersBlock);
changes.set(ordersPath, ordersContent);


// Validate every replacement before writing any target file.
fs.mkdirSync(backupDir);
for (const [target, original] of originals) {
  fs.writeFileSync(path.join(backupDir, path.basename(target)), original, 'utf8');
}
for (const [target, source] of changes) fs.writeFileSync(target, source, 'utf8');
console.log('Applied all 5 static benchmark patterns. CWE-89 is static-only with MongoDB.');
