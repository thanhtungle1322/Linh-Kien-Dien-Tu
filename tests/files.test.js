const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");

test("Datasheet File Service & Path Traversal Guard Tests", async (t) => {
  await t.test("GET /api/files/download succeeds for legitimate datasheet", async () => {
    const res = await request(app).get("/api/files/download?file=arduino-uno-r3.pdf");
    assert.equal(res.status, 200);
    const content = res.text || res.body.toString();
    assert.ok(content.includes("ATmega328P"));
  });

  await t.test("GET /api/files/download blocks relative path traversal attacks (CWE-22)", async () => {
    const res = await request(app).get("/api/files/download?file=../../package.json");
    // Path traversal attempt should either be stripped by path.basename or rejected with 403/404
    // Since basename("../../package.json") is "package.json", it checks if package.json exists in datasheets/ (it doesn't, so 404),
    // and traversal sequences that escape root are rejected with 403.
    assert.ok(res.status === 403 || res.status === 404);
    assert.ok(!res.text.includes("devDependencies"));
  });

  await t.test("GET /api/files/download returns 404 for missing datasheet", async () => {
    const res = await request(app).get("/api/files/download?file=nonexistent-ic.pdf");
    assert.equal(res.status, 404);
  });
});
