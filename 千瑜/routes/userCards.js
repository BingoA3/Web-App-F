const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const db = require("../db");

// GET user cards
router.get("/", auth, async (req, res) => {
  const result = await db.query(
    `
    SELECT 
      uc.uc_id AS user_card_id,
      c.card_id,
      b.name AS bank_name,
      c.name AS card_name
    FROM user_cards uc
    JOIN cards c ON uc.card_id = c.card_id
    JOIN banks b ON c.bank_id = b.bank_id
    WHERE uc.user_id=$1
    ORDER BY uc.uc_id
    `,
    [req.user.user_id]
  );

  res.json(result.rows);
});

// PUT user cards
router.put("/", auth, async (req, res) => {
  const { card_ids } = req.body;

  if (card_ids.length > 3)
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "最多只能選三張卡"
    });

  const check = await db.query(
    `SELECT card_id FROM cards WHERE card_id = ANY($1)`,
    [card_ids]
  );

  if (check.rows.length !== card_ids.length)
    return res.status(400).json({
      error: "INVALID_CARD_ID",
      message: "部分卡片不存在"
    });

  await db.query(`DELETE FROM user_cards WHERE user_id=$1`, [
    req.user.user_id
  ]);

  for (const id of card_ids)
    await db.query(
      `INSERT INTO user_cards (user_id, card_id) VALUES ($1, $2)`,
      [req.user.user_id, id]
    );

  res.json({
    user_id: req.user.user_id,
    card_ids
  });
});

module.exports = router;
