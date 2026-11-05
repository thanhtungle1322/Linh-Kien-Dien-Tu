const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Defined safe directory for component technical datasheets
const DATASHEETS_DIR = path.resolve(__dirname, "../public/datasheets");

/**
 * GET /download and /api/files/download
 * Download technical specification datasheets for electronic components (PDF/Docs)
 * 
 * SECURE IMPLEMENTATION (Commit 1 - Clean Release):
 * CWE-22 (Path Traversal):
 * 1. Sanitizes filename with path.basename() to strip relative directory traversal vectors (../, ..\).
 * 2. Resolves canonical absolute path and validates containment using startsWith().
 * 3. Enforces 403 Forbidden on illegal traversal attempts.
 */
router.get("/download", (req, res) => {
  const fileParam = req.query.file;

  if (!fileParam) {
    return res.status(400).json({ error: "Missing required 'file' query parameter" });
  }

  // SECURE: Strip directory components using path.basename
  const safeFilename = path.basename(fileParam);
  const fullPath = path.resolve(DATASHEETS_DIR, safeFilename);

  // SECURE: Whitelist verification and directory boundary check
  if (!fullPath.startsWith(DATASHEETS_DIR)) {
    return res.status(403).send("Forbidden: Directory traversal attempt detected");
  }

  // Check if target datasheet exists
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: `Datasheet '${safeFilename}' không tồn tại trên hệ thống` });
  }

  // Safe file delivery
  res.sendFile(fullPath);
});

/**
 * GET /api/files/list - List available public technical datasheets
 */
router.get("/list", (req, res) => {
  try {
    if (!fs.existsSync(DATASHEETS_DIR)) {
      return res.json({ datasheets: [] });
    }
    const files = fs.readdirSync(DATASHEETS_DIR).filter(f => !f.startsWith("."));
    res.json({
      total: files.length,
      datasheets: files
    });
  } catch (err) {
    res.status(500).json({ error: "Unable to enumerate datasheets" });
  }
});

module.exports = router;
