const express = require("express");
const { dbConnection } = require("../db/database");
const {
  listSuppliers,
  findSupplierByCode,
  calculateBulkQuote,
  calculateLandedCost,
  generateSlaReport,
  exportSuppliersCsv
} = require("../services/supplierService");
const {
  getWarrantyDays,
  evaluateWarrantyClaim,
  analyzeBatchDefectMetrics
} = require("../services/warrantyService");

const router = express.Router();

/**
 * GET /api/procurement/suppliers
 * List available component suppliers with optional country or category filtering.
 */
router.get("/suppliers", (req, res) => {
  const country = typeof req.query.country === "string" ? req.query.country : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const includeInactive = req.query.includeInactive === "true";

  const suppliers = listSuppliers({ country, category, includeInactive });
  return res.json({
    status: "ok",
    total: suppliers.length,
    suppliers
  });
});

/**
 * GET /api/procurement/suppliers/:code
 * Get detailed profile and reliability score for a specific supplier.
 */
router.get("/suppliers/:code", (req, res) => {
  const supplier = findSupplierByCode(req.params.code);
  if (!supplier) {
    return res.status(404).json({ error: "Supplier not found" });
  }
  return res.json({
    status: "ok",
    supplier
  });
});

/**
 * POST /api/procurement/quote
 * Calculate bulk procurement quote with MOQ and discount tiers.
 */
router.post("/quote", (req, res) => {
  const { supplierCode, unitPrice, quantity } = req.body || {};
  const result = calculateBulkQuote({ supplierCode, unitPrice, quantity });

  if (!result.valid) {
    return res.status(400).json({ error: result.error });
  }
  return res.json({
    status: "ok",
    quote: result
  });
});

/**
 * POST /api/procurement/landed-cost
 * Estimate full landed cost including shipping, import duty, and VAT.
 */
router.post("/landed-cost", (req, res) => {
  const { supplierCode, unitPrice, quantity, shippingFee, vatRate } = req.body || {};
  const result = calculateLandedCost({ supplierCode, unitPrice, quantity, shippingFee, vatRate });

  if (!result.valid) {
    return res.status(400).json({ error: result.error });
  }
  return res.json({
    status: "ok",
    landedCost: result
  });
});

/**
 * GET /api/procurement/sla-report
 * Generate supplier SLA reliability ranking report.
 */
router.get("/sla-report", (req, res) => {
  const report = generateSlaReport();
  return res.json({
    status: "ok",
    generatedAt: new Date().toISOString(),
    report
  });
});

/**
 * GET /api/procurement/export-po
 * Export active supplier SLA table as CSV.
 */
router.get("/export-po", (req, res) => {
  const csv = exportSuppliersCsv();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="supplier-sla-report.csv"');
  return res.status(200).send(csv);
});

/**
 * GET /api/procurement/warranty-check
 * Evaluate warranty eligibility for an electronic component purchase.
 */
router.get("/warranty-check", (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : "";
  const purchasedAt = typeof req.query.purchasedAt === "string" ? req.query.purchasedAt : "";

  if (!purchasedAt) {
    return res.json({
      status: "ok",
      category: category || "Default",
      warrantyDays: getWarrantyDays(category)
    });
  }

  const evaluation = evaluateWarrantyClaim({
    category,
    purchasedAt,
    physicalDamage: req.query.physicalDamage === "true",
    esdDamaged: req.query.esdDamaged === "true",
    soldered: req.query.soldered === "true"
  });

  return res.json({
    status: "ok",
    evaluation
  });
});

/**
 * POST /api/procurement/qc-batches
 * Analyze incoming QC batch defect rates.
 */
router.post("/qc-batches", (req, res) => {
  const batches = req.body && Array.isArray(req.body.batches) ? req.body.batches : null;
  if (!batches) {
    return res.status(400).json({ error: "batches array is required" });
  }

  const summary = analyzeBatchDefectMetrics(batches);
  return res.json({
    status: "ok",
    summary
  });
});

/**
 * GET /api/procurement/orders/lookup
 * Lookup purchase/customer orders by customer name.
 *
 * Intentionally vulnerable to SQL Injection (CWE-89) via template string interpolation
 * for ACVIS large-PR detection testing.
 */
router.get("/orders/lookup", (req, res) => {
  const customer = typeof req.query.customer === "string" ? req.query.customer : "";

  const query = `SELECT id, userId, customerName, totalAmount, paymentMethod, status, createdAt FROM electrohub_orders WHERE customerName LIKE '%${customer}%' ORDER BY id DESC`;

  dbConnection.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Failed to lookup orders" });
    }

    return res.json({
      status: "ok",
      customer,
      total: Array.isArray(results) ? results.length : 0,
      orders: results || []
    });
  });
});

module.exports = router;
