const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const {
  validateThreshold,
  calculateValuation,
  groupByCategory,
  computeAbcClassification,
  getReorderAlerts,
  calculateStockHealthScore,
  escapeCsvCell,
  formatValuationCsv
} = require("../services/inventoryAnalytics");

test("Inventory Analytics Service Unit Tests", async (t) => {
  const sampleProducts = [
    { id: 1, name: "ESP32-S3", category: "MCU", price: 150000, stock: 100, rating: 4.8 },
    { id: 2, name: "DHT22", category: "Sensors", price: 85000, stock: 10, rating: 4.5 },
    { id: 3, name: "Resistor Kit", category: "Passive", price: 25000, stock: 0, rating: 4.2 }
  ];

  await t.test("validateThreshold accepts valid integers and falls back otherwise", () => {
    assert.equal(validateThreshold("30"), 30);
    assert.equal(validateThreshold(0), 0);
    assert.equal(validateThreshold("-5", 25), 25);
    assert.equal(validateThreshold("abc", 25), 25);
    assert.equal(validateThreshold(undefined, 20), 20);
  });

  await t.test("calculateValuation computes totals and extremes accurately", () => {
    const val = calculateValuation(sampleProducts);
    assert.equal(val.totalSkus, 3);
    assert.equal(val.totalUnits, 110);
    assert.equal(val.totalValue, 15000000 + 850000);
    assert.equal(val.highestValueItem.id, 1);
    assert.equal(val.lowestStockItem.id, 3);
  });

  await t.test("groupByCategory aggregates by category descending by value", () => {
    const grouped = groupByCategory(sampleProducts);
    assert.equal(grouped.length, 3);
    assert.equal(grouped[0].category, "MCU");
    assert.equal(grouped[0].totalValue, 15000000);
  });

  await t.test("computeAbcClassification assigns A/B/C classes", () => {
    const abc = computeAbcClassification(sampleProducts);
    assert.equal(abc.length, 3);
    assert.equal(abc[0].id, 1);
    assert.ok(["A", "B", "C"].includes(abc[0].abcClass));
  });

  await t.test("getReorderAlerts filters items at or below threshold", () => {
    const alerts = getReorderAlerts(sampleProducts, 25);
    assert.equal(alerts.length, 2);
    assert.equal(alerts[0].id, 3);
    assert.equal(alerts[0].urgency, "CRITICAL");
  });

  await t.test("calculateStockHealthScore penalizes out-of-stock and low-stock SKUs", () => {
    const health = calculateStockHealthScore(sampleProducts);
    assert.equal(health.outOfStockCount, 1);
    assert.equal(health.lowStockCount, 1);
    assert.equal(health.score, 80);
  });

  await t.test("escapeCsvCell neutralizes spreadsheet formula prefixes and quotes commas", () => {
    assert.equal(escapeCsvCell("=SUM(A1)"), "'=SUM(A1)");
    assert.equal(escapeCsvCell("Sensor, DHT22"), '"Sensor, DHT22"');
  });

  await t.test("formatValuationCsv builds valid CSV header and rows", () => {
    const csv = formatValuationCsv(sampleProducts);
    const lines = csv.split("\n");
    assert.equal(lines.length, 4);
    assert.equal(lines[0], "ID,Name,Category,Price,Stock,TotalValue,Rating");
  });
});

test("Inventory Analytics HTTP Endpoints", async (t) => {
  await t.test("GET /api/analytics/summary returns valuation and health", async () => {
    const res = await request(app).get("/api/analytics/summary");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
    assert.ok(res.body.valuation.totalSkus >= 8);
    assert.ok(typeof res.body.health.score === "number");
  });

  await t.test("GET /api/analytics/categories returns category breakdown", async () => {
    const res = await request(app).get("/api/analytics/categories");
    assert.equal(res.status, 200);
    assert.ok(res.body.totalCategories >= 1);
  });

  await t.test("GET /api/analytics/abc returns ABC classification", async () => {
    const res = await request(app).get("/api/analytics/abc");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
  });

  await t.test("GET /api/analytics/reorder-alerts supports custom threshold", async () => {
    const res = await request(app).get("/api/analytics/reorder-alerts?threshold=50");
    assert.equal(res.status, 200);
    assert.equal(res.body.threshold, 50);
  });

  await t.test("GET /api/analytics/export-csv returns CSV attachment", async () => {
    const res = await request(app).get("/api/analytics/export-csv");
    assert.equal(res.status, 200);
    assert.ok(res.headers["content-type"].includes("text/csv"));
    assert.ok(res.text.startsWith("ID,Name,Category,Price,Stock,TotalValue,Rating"));
  });
});
