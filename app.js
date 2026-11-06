require("dotenv").config();
const express = require("express");
const path = require("path");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const fileRoutes = require("./routes/files");
const orderRoutes = require("./routes/orders");

const app = express();

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, "public")));

// Direct endpoint routing to support exact JFVT/ACVIS test paths
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/orders", orderRoutes);

// Explicit aliases for exact dataset endpoint signatures
// 1. GET /preview/echo (CWE-79 reflected XSS target)
app.get("/preview/echo", (req, res, next) => {
  productRoutes(req, res, next);
});

// 2. Health check & system info endpoint
app.get("/api/health", async (req, res) => {
  let database;
  try {
    database = await require('./db/database').health();
  } catch (error) {
    const errorCode = require('./db/database').failureCode(error);
    console.error('MongoDB health check failed:', errorCode);
    return res.status(503).json({ status: 'unhealthy', database: { provider: 'mongodb', status: 'unavailable', errorCode } });
  }
  res.json({
    status: "healthy",
    database,
    service: "ElectroHub - Linh Kiện Điện Tử & IoT Store",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

module.exports = app;
