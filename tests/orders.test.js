const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");

test("Order Invoices & Insecure Direct Object Reference (IDOR) Tests", async (t) => {
  let customerToken = "";
  let adminToken = "";

  // Helper login
  const customerLogin = await request(app)
    .post("/api/auth/login")
    .send({ username: "thanhtung", password: "Password123!" });
  customerToken = customerLogin.body.token;

  const adminLogin = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: "AdminPassword123!" });
  adminToken = adminLogin.body.token;

  await t.test("GET /api/orders/:id requires authentication token", async () => {
    const res = await request(app).get("/api/orders/1001");
    assert.equal(res.status, 401);
  });

  await t.test("GET /api/orders/:id allows customer to access their own order #1001", async () => {
    const res = await request(app)
      .get("/api/orders/1001")
      .set("Authorization", `Bearer ${customerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, 1001);
    assert.equal(res.body.customerName, "Lê Thanh Tùng");
  });

  await t.test("GET /api/orders/:id prevents IDOR attack against order #2001 (CWE-639)", async () => {
    // Order #2001 belongs to user 3 (Nguyễn Văn An). User 2 (thanhtung) must NOT be able to view it.
    const res = await request(app)
      .get("/api/orders/2001")
      .set("Authorization", `Bearer ${customerToken}`);

    assert.equal(res.status, 403);
    assert.ok(res.body.error.includes("Access denied"));
  });

  await t.test("GET /api/orders/:id prevents IDOR attack against target order #900875 (CWE-639)", async () => {
    // Order #900875 belongs to user 3. Customer thanhtung must receive 403 Access Denied.
    const res = await request(app)
      .get("/api/orders/900875")
      .set("Authorization", `Bearer ${customerToken}`);

    assert.equal(res.status, 403);
  });

  await t.test("GET /api/orders/:id allows admin to view any order", async () => {
    const res = await request(app)
      .get("/api/orders/900875")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, 900875);
  });
});
