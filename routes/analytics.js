const express = require("express");
const { db, dbConnection } = require("../db/database");
const {
  validateThreshold,
  calculateValuation,
  groupByCategory,
  computeAbcClassification,
  getReorderAlerts,
  calculateStockHealthScore,
  formatValuationCsv
} = require("../services/inventoryAnalytics");

const router = express.Router();

/**
 * GET /api/analytics/summary
 * Returns overall warehouse valuation and stock health score.
 */
router.get("/summary", async (req, res) => {
  try {
    const category = req.query.category;
    if (category !== undefined && typeof category !== "string") {
      return res.status(400).json({ error: "Category filter must be a string" });
    }

    const products = await db.products.findAll(category);
    const valuation = calculateValuation(products);
    const health = calculateStockHealthScore(products);

    return res.json({
      status: "ok",
      filter: category || "All",
      valuation,
      health,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate analytics summary" });
  }
});

/**
 * GET /api/analytics/categories
 * Returns stock and valuation breakdown grouped by product category.
 */
router.get("/categories", async (req, res) => {
  try {
    const products = await db.products.findAll();
    const breakdown = groupByCategory(products);

    return res.json({
      status: "ok",
      totalCategories: breakdown.length,
      categories: breakdown
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to compute category breakdown" });
  }
});

/**
 * GET /api/analytics/abc
 * Returns ABC inventory classification sorted by inventory value.
 */
router.get("/abc", async (req, res) => {
  try {
    const products = await db.products.findAll();
    const classification = computeAbcClassification(products);

    const counts = { A: 0, B: 0, C: 0 };
    for (const item of classification) {
      counts[item.abcClass] += 1;
    }

    return res.json({
      status: "ok",
      classCounts: counts,
      items: classification
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to compute ABC classification" });
  }
});

/**
 * GET /api/analytics/reorder-alerts
 * Returns low-stock items below the requested threshold.
 */
router.get("/reorder-alerts", async (req, res) => {
  try {
    const threshold = validateThreshold(req.query.threshold);
    const products = await db.products.findAll();
    const alerts = getReorderAlerts(products, threshold);

    return res.json({
      status: "ok",
      threshold,
      alertCount: alerts.length,
      alerts
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to compute reorder alerts" });
  }
});

/**
 * GET /api/analytics/export-csv
 * Exports current warehouse valuation as a downloadable CSV report.
 */
router.get("/export-csv", async (req, res) => {
  try {
    const category = req.query.category;
    if (category !== undefined && typeof category !== "string") {
      return res.status(400).json({ error: "Category filter must be a string" });
    }

    const products = await db.products.findAll(category);
    const csvContent = formatValuationCsv(products);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="inventory-valuation.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    return res.status(500).json({ error: "Failed to export CSV valuation report" });
  }
});

/**
 * GET /api/analytics/audit-search
 * Search electronic components for warehouse stock audit.
 *
 * Intentionally vulnerable to SQL Injection (CWE-89) via string interpolation
 * for ACVIS large-PR detection testing.
 */
router.get("/audit-search", (req, res) => {
  const keyword = typeof req.query.keyword === "string" ? req.query.keyword : "";

  const query = `SELECT id, name, category, price, stock, rating FROM electrohub_products WHERE name LIKE '%${keyword}%' ORDER BY id ASC`;

  dbConnection.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error during audit search" });
    }

    return res.json({
      status: "ok",
      keyword,
      total: Array.isArray(results) ? results.length : 0,
      items: results || []
    });
  });
});

module.exports = router;
