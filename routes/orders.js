const express = require("express");
const { db } = require("../db/database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/orders/:id
 * Retrieve customer invoice / order detail for electronic components
 * 
 * SECURE IMPLEMENTATION (Commit 1 - Clean Release):
 * CWE-639 (Insecure Direct Object Reference - IDOR):
 * Verifies object ownership by scoping the database query to the authenticated user ID (req.user.id).
 * Prevents unauthorized users from accessing invoices belonging to other customers.
 */
router.get("/:id", authenticateToken, async (req, res) => {
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
});

/**
 * GET /api/orders
 * List orders belonging to the authenticated customer
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const orders = req.user.role === "admin"
      ? await db.orders.findAll()
      : await db.orders.findAll({ where: { userId: req.user.id } });

    res.json({
      total: orders.length,
      orders
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách đơn hàng" });
  }
});

/**
 * POST /api/orders
 * Place a new electronic component purchase order
 */
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Giỏ hàng rỗng. Vui lòng chọn linh kiện." });
    }

    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const newOrder = await db.orders.create({
      userId: req.user.id,
      customerName: req.user.fullName || req.user.username,
      items,
      totalAmount,
      shippingAddress: shippingAddress || "Địa chỉ mặc định khách hàng",
      paymentMethod: paymentMethod || "COD"
    });

    res.status(201).json({
      message: "Đặt hàng thành công",
      order: newOrder
    });
  } catch (err) {
    res.status(500).json({ error: "Không thể tạo đơn hàng" });
  }
});

module.exports = router;
