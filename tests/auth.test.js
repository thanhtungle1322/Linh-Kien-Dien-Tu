const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");

test("Authentication & Security Baseline Tests", async (t) => {
  await t.test("POST /api/auth/login succeeds with valid user credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "thanhtung", password: "Password123!" });

    assert.equal(res.status, 200);
    assert.ok(res.body.token, "Response must include JWT token");
    assert.equal(res.body.user.username, "thanhtung");
    assert.equal(res.body.user.role, "customer");
  });

  await t.test("POST /api/auth/login fails on incorrect password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "thanhtung", password: "WrongPassword" });

    assert.equal(res.status, 401);
  });

  await t.test("POST /api/auth/login protects against SQL Injection attempt (CWE-89)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "' OR '1'='1", password: "' OR '1'='1" });

    // In Version 1 (Clean), parameterized queries treat input as literal strings
    assert.equal(res.status, 401);
  });
});
