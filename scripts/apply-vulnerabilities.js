/**
 * Script to automatically apply the 5 ACVIS benchmark vulnerabilities
 * for Commit 2 testing.
 * 
 * Rules applied:
 * 1. CWE-89  (cn_664): SQL injection via string interpolation in auth.js
 * 2. CWE-798 (gen_secret_javascript_5160): Hardcoded Stripe secret in auth.js
 * 3. CWE-79  (javascript_express_js_refund_00009): Reflected XSS in products.js
 * 4. CWE-22  (javascript_express_js_warehouse_00061): Path traversal in files.js
 * 5. CWE-639 (gen_idor_javascript_2896): IDOR in orders.js
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

console.log('🔄 Applying 5 ACVIS vulnerabilities for Commit 2...');

// 1 & 5: auth.js -> CWE-89 & CWE-798
const authPath = path.join(rootDir, 'routes', 'auth.js');
let authContent = fs.readFileSync(authPath, 'utf8');

// Replace JWT_SECRET with hardcoded secret (CWE-798: gen_secret_javascript_5160)
authContent = authContent.replace(
  /const JWT_SECRET = process\.env\.JWT_SECRET \|\| .*?;/,
  `// Hardcoded Stripe Key [113118]\nconst JWT_SECRET = 'sk_live_37509765_secret_1595';`
);

// Replace parameterized query with string interpolation (CWE-89: cn_664)
const safeAuthBlock = `  // SECURE: Parameterized query prevents SQL Injection (OWASP CWE-89 mitigation)
  const query = "SELECT * FROM users WHERE username = ? AND password = ?";

  dbConnection.query(query, [username, password], (err, results) => {`;

const vulnAuthBlock = `  // VULNERABLE: Direct string interpolation into SQL query (CWE-89 / cn_664)
  let query = \`SELECT * FROM users WHERE username='\${username}' AND password='\${password}'\`;

  dbConnection.query(query, (err, results) => {`;

authContent = authContent.replace(safeAuthBlock, vulnAuthBlock);
fs.writeFileSync(authPath, authContent, 'utf8');
console.log('  ✅ Injected CWE-89 & CWE-798 into routes/auth.js');

// 2: products.js -> CWE-79 (javascript_express_js_refund_00009)
const productsPath = path.join(rootDir, 'routes', 'products.js');
let productsContent = fs.readFileSync(productsPath, 'utf8');

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

productsContent = productsContent.replace(safeProductsBlock, vulnProductsBlock);
fs.writeFileSync(productsPath, productsContent, 'utf8');
console.log('  ✅ Injected CWE-79 into routes/products.js');

// 3: files.js -> CWE-22 (javascript_express_js_warehouse_00061)
const filesPath = path.join(rootDir, 'routes', 'files.js');
let filesContent = fs.readFileSync(filesPath, 'utf8');

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
  res.sendFile('/uploads/warehouse/' + file);
});`;

filesContent = filesContent.replace(safeFilesBlock, vulnFilesBlock);
fs.writeFileSync(filesPath, filesContent, 'utf8');
console.log('  ✅ Injected CWE-22 into routes/files.js');

// 4: orders.js -> CWE-639 (gen_idor_javascript_2896)
const ordersPath = path.join(rootDir, 'routes', 'orders.js');
let ordersContent = fs.readFileSync(ordersPath, 'utf8');

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
router.get("/:id", async (req, res) => {
  const data = await db.orders.findOne({ where: { id: req.params.id } });
  res.json(data);
});`;

ordersContent = ordersContent.replace(safeOrdersBlock, vulnOrdersBlock);
fs.writeFileSync(ordersPath, ordersContent, 'utf8');
console.log('  ✅ Injected CWE-639 into routes/orders.js');

console.log('\\n✨ All 5 vulnerabilities successfully applied! Ready for Commit 2.\\n');
