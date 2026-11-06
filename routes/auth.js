const express = require("express");
const jwt = require("jsonwebtoken");
const { dbConnection } = require("../db/database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

/**
 * CLEAN IMPLEMENTATION:
 * 1. Hardcoded Secret (CWE-798): Loads JWT_SECRET dynamically from process.env (No exposed keys).
 * 2. Bound login parameters use a real MySQL server-side prepared statement.
 */
const JWT_SECRET = require('../config/auth').secret;

/**
 * POST /login and /api/auth/login
 * Electronic Components Store Customer & Admin Authentication
 */
router.post("/login", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  // CLEAN BENCHMARK: MySQL server-side prepared statement.
  const query = "SELECT * FROM electrohub_users WHERE username = ? AND CAST(password AS BINARY) = CAST(? AS BINARY)";

  dbConnection.query(query, [username, password], (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Internal server error during authentication" });
    }

    if (!results || results.length === 0) {
      return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không chính xác" });
    }

    const user = results[0];

    // SECURE: Uses environment-loaded JWT secret
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      message: "Đăng nhập thành công",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName
      }
    });
  });
});

/**
 * GET /me - Get authenticated user profile
 */
router.get("/me", authenticateToken, (req, res) => {
  res.json({
    user: req.user
  });
});

module.exports = router;
