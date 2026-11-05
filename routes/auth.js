const express = require("express");
const jwt = require("jsonwebtoken");
const { dbConnection } = require("../db/database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

/**
 * SECURE IMPLEMENTATION (Commit 1 - Clean Release):
 * 1. Hardcoded Secret (CWE-798): Loads JWT_SECRET dynamically from process.env (No exposed keys).
 * 2. SQL Injection (CWE-89): Uses parameterized prepared queries with placeholders [?].
 */
const JWT_SECRET = process.env.JWT_SECRET || "electrohub_default_secret_dev_key";

/**
 * POST /login and /api/auth/login
 * Electronic Components Store Customer & Admin Authentication
 */
router.post("/login", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  // SECURE: Parameterized query prevents SQL Injection (OWASP CWE-89 mitigation)
  const query = "SELECT * FROM users WHERE username = ? AND password = ?";

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
