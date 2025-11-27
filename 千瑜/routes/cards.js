const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", async (_, res) => {
  const result = await db.query(`
    SELECT 
      c.card_id,
      b.name AS bank_name,
      c.name AS card_name
    FROM cards c
    JOIN banks b ON c.bank_id = b.bank_id
    ORDER BY c.card_id
  `);

  res.json(result.rows);
});

module.exports = router;
