const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const db = require("../db");


router.get("/", auth, async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT DISTINCT mcc_type
      FROM merchant_categories
      ORDER BY mcc_type
      `
    );

    res.json({
      mcc_types: result.rows.map(r => r.mcc_type)
    });
  } catch (err) {
    console.error("Error fetching mcc_types:", err);
    res.status(500).json({ error: "Failed to fetch mcc types" });
  }
});

module.exports = router;