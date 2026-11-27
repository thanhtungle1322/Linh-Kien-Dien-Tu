const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const {
  listSuppliers,
  findSupplierByCode,
  computeSupplierReliabilityScore,
  resolveVolumeDiscountTier,
  calculateBulkQuote,
  calculateLandedCost,
  generateSlaReport,
  sanitizeCsvField,
  exportSuppliersCsv
} = require("../services/supplierService");
const {
  getWarrantyDays,
  evaluateWarrantyClaim,
  analyzeBatchDefectMetrics
} = require("../services/warrantyService");

test("Supplier & Procurement Domain Service Tests", async (t) => {
  await t.test("listSuppliers filters out inactive vendors by default", () => {
    const active = listSuppliers();
    assert.ok(active.every((s) => s.active === true));
    const all = listSuppliers({ includeInactive: true });
    assert.ok(all.length > active.length);
  });

  await t.test("findSupplierByCode resolves valid code case-insensitively", () => {
    const supplier = findSupplierByCode("sup-espressif-vn");
    assert.ok(supplier);
    assert.equal(supplier.country, "VN");
    assert.equal(findSupplierByCode("NON_EXISTENT"), null);
  });

  await t.test("computeSupplierReliabilityScore returns bounded 0-100 score", () => {
    const supplier = findSupplierByCode("SUP-SENSIRION-SG");
    const score = computeSupplierReliabilityScore(supplier);
    assert.ok(score > 85 && score <= 100);
  });

  await t.test("resolveVolumeDiscountTier selects highest matching tier", () => {
    assert.equal(resolveVolumeDiscountTier(500).tierName, "ENTERPRISE_500");
    assert.equal(resolveVolumeDiscountTier(200).tierName, "WHOLESALE_200");
    assert.equal(resolveVolumeDiscountTier(50).tierName, "BULK_50");
    assert.equal(resolveVolumeDiscountTier(5).tierName, "STANDARD");
  });

  await t.test("calculateBulkQuote computes discount and MOQ flags", () => {
    const quote = calculateBulkQuote({
      supplierCode: "SUP-ESPRESSIF-VN",
      unitPrice: 100000,
      quantity: 50
    });
    assert.equal(quote.valid, true);
    assert.equal(quote.meetsMoq, true);
    assert.equal(quote.grossSubtotal, 5000000);
    assert.equal(quote.discountAmount, 350000);
    assert.equal(quote.netSubtotal, 4650000);
  });

  await t.test("calculateLandedCost includes customs duty and VAT", () => {
    const landed = calculateLandedCost({
      supplierCode: "SUP-SENSIRION-SG",
      unitPrice: 100000,
      quantity: 50,
      shippingFee: 200000
    });
    assert.equal(landed.valid, true);
    assert.equal(landed.dutyRate, 0.02);
    assert.ok(landed.totalLandedCost > landed.netSubtotal);
  });

  await t.test("generateSlaReport ranks active suppliers descending", () => {
    const report = generateSlaReport();
    assert.ok(report.totalActiveSuppliers >= 5);
    assert.ok(report.suppliers[0].reliabilityScore >= report.suppliers[1].reliabilityScore);
  });

  await t.test("sanitizeCsvField and exportSuppliersCsv format safely", () => {
    assert.equal(sanitizeCsvField("=HYPERLINK()"), "'=HYPERLINK()");
    const csv = exportSuppliersCsv();
    assert.ok(csv.startsWith("Code,Name,Country,LeadTimeDays"));
  });
});

test("Warranty & RMA Service Tests", async (t) => {
  await t.test("getWarrantyDays returns category-specific periods", () => {
    assert.equal(getWarrantyDays("MCU"), 365);
    assert.equal(getWarrantyDays("Sensors"), 180);
    assert.equal(getWarrantyDays("Unknown"), 90);
  });

  await t.test("evaluateWarrantyClaim approves valid claim and rejects ESD/physical damage", () => {
    const approved = evaluateWarrantyClaim({
      category: "MCU",
      purchasedAt: "2026-11-15T00:00:00Z",
      claimDate: "2026-11-25T00:00:00Z"
    });
    assert.equal(approved.eligible, true);
    assert.equal(approved.resolution, "DIRECT_REPLACEMENT");

    const rejected = evaluateWarrantyClaim({
      category: "MCU",
      purchasedAt: "2026-11-15T00:00:00Z",
      claimDate: "2026-11-25T00:00:00Z",
      esdDamaged: true
    });
    assert.equal(rejected.eligible, false);
    assert.equal(rejected.resolution, "REJECTED");
  });

  await t.test("analyzeBatchDefectMetrics flags batches over 2% defect rate", () => {
    const result = analyzeBatchDefectMetrics([
      { batchId: "B-01", inspectedQty: 1000, defectiveQty: 5 },
      { batchId: "B-02", inspectedQty: 500, defectiveQty: 25 }
    ]);
    assert.equal(result.totalBatches, 2);
    assert.equal(result.rejectedBatches.length, 1);
    assert.equal(result.rejectedBatches[0].batchId, "B-02");
  });
});

test("Procurement HTTP API Endpoints", async (t) => {
  await t.test("GET /api/procurement/suppliers filters by country", async () => {
    const res = await request(app).get("/api/procurement/suppliers?country=VN");
    assert.equal(res.status, 200);
    assert.ok(res.body.suppliers.every((s) => s.country === "VN"));
  });

  await t.test("POST /api/procurement/quote returns bulk quote", async () => {
    const res = await request(app)
      .post("/api/procurement/quote")
      .send({ supplierCode: "SUP-ESPRESSIF-VN", unitPrice: 120000, quantity: 20 });
    assert.equal(res.status, 200);
    assert.equal(res.body.quote.discountTier, "STARTER_20");
  });

  await t.test("POST /api/procurement/landed-cost computes total cost", async () => {
    const res = await request(app)
      .post("/api/procurement/landed-cost")
      .send({ supplierCode: "SUP-MEANWELL-VN", unitPrice: 200000, quantity: 10, shippingFee: 50000 });
    assert.equal(res.status, 200);
    assert.ok(res.body.landedCost.totalLandedCost > 2000000);
  });

  await t.test("GET /api/procurement/export-po returns CSV download", async () => {
    const res = await request(app).get("/api/procurement/export-po");
    assert.equal(res.status, 200);
    assert.ok(res.headers["content-type"].includes("text/csv"));
  });
});
