// Temporary ACVIS webhook probe. Not imported by the application; removed right after the test.
const express = require('express');
const router = express.Router();

router.get('/probe/:name', async (req, res) => {
  const db = req.app.locals.db;
  const rows = await db.query(`SELECT * FROM products WHERE name = '${req.params.name}'`);
  res.json(rows);
});

module.exports = router;
