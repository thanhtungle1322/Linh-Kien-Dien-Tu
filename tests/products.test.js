const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");

test("Electronic Components Catalog & Preview Echo Tests", async (t) => {
  await t.test("GET /api/products returns electronic components catalog", async () => {
    const res = await request(app).get("/api/products");
    assert.equal(res.status, 200);
    assert.ok(res.body.products.length >= 8);
    assert.equal(res.body.category, "All");
  });

  await t.test("GET /api/products?category=Sensors filters products by category", async () => {
    const res = await request(app).get("/api/products?category=Sensors");
    assert.equal(res.status, 200);
    assert.ok(res.body.products.every(p => p.category === "Sensors"));
  });

  await t.test("GET /preview/echo safely sanitizes payload to prevent Reflected XSS (CWE-79)", async () => {
    const maliciousScript = "<script>alert('XSS')</script>";
    const res = await request(app).get(`/preview/echo?name=${encodeURIComponent(maliciousScript)}`);

    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"].includes("application/json"), true);
    // Verified that angle brackets are escaped into HTML entities
    assert.equal(res.body.name.includes("<script>"), false);
    assert.equal(res.body.name, "&lt;script&gt;alert(&#39;XSS&#39;)&lt;/script&gt;");
  });
});
