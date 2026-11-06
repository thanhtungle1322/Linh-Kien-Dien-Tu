const express = require("express");
const escapeHtml = require("escape-html");
const { db } = require("../db/database");

const router = express.Router();

/**
 * GET /preview/echo
 * Preview electronic component description or customer inquiry echo.
 *
 * ACVIS remediation (CWE-79): context-aware HTML output encoding before reflection,
 * so user input is rendered as literal text instead of executable markup.
 */
router.get("/preview/echo", (req, res) => {
  const desc = req.query.name || '';
  const sanitizedDesc = desc
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  res.send(`<div class="refund-detail"><p>${sanitizedDesc}</p></div>`);
});

/**
 * GET /api/products
 * List electronic components with optional category filter
 */
router.get("/", async (req, res) => {
  try {
    const category = req.query.category;
    if (category !== undefined && typeof category !== 'string') {
      return res.status(400).json({ error: 'Category must be a string' });
    }
    const products = await db.products.findAll(category);
    res.json({
      total: products.length,
      category: category || "All",
      products
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve products" });
  }
});

/**
 * GET /api/products/:id
 * Retrieve a specific electronic component detail
 */
router.get("/:id", async (req, res) => {
  try {
    const product = await db.products.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Không tìm thấy linh kiện điện tử này" });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Error fetching product details" });
  }
});

module.exports = router;
