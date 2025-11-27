const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const db = require("../db");

router.get("/me", auth, async (req, res) => {
  const result = await db.query(
    `SELECT user_id, username AS display_name, email 
     FROM users WHERE user_id=$1`,
    [req.user.user_id]
  );
  res.json(result.rows[0]);
});

module.exports = router;
