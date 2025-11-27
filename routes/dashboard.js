// 部分欄位需 B

const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const db = require("../db");

router.get("/", auth, async (req, res) => {
  const uid = req.user.user_id;

  /* =============================
     SUMMARY：本月總消費（回饋值已移除）
     ============================= */
  const summary = await db.query(
    `
    SELECT 
      COALESCE(SUM(t.amount), 0) AS current_month_spending
    FROM transactions t
    WHERE t.user_id = $1
      AND date_trunc('month', t.transaction_date) = date_trunc('month', CURRENT_DATE)
    `,
    [uid]
  );

  /* =============================
     CARDS：卡片資訊 + 本月消費 + 回饋明細
     ============================= */
  const cards = await db.query(
    `
    SELECT
      c.card_id,
      b.name AS bank_name,
      c.name AS card_name,

      COALESCE(SUM(tp.amount) FILTER (
        WHERE date_trunc('month', t.transaction_date) = date_trunc('month', CURRENT_DATE)
      ), 0) AS month_spending,

      COALESCE(
        (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'reward_mode', rt.reward_type,
              'reward_amount', rt.total_reward
            )
          )
          FROM (
            SELECT 
              tp2.reward_type,
              SUM(tp2.reward_amount) AS total_reward
            FROM transaction_payments tp2
            JOIN transactions t2
              ON t2.transaction_id = tp2.transaction_id
            WHERE tp2.card_id = c.card_id
            AND date_trunc('month', t2.transaction_date) = date_trunc('month', CURRENT_DATE)
            GROUP BY tp2.reward_type
          ) rt
        ),
        '[]'
      ) AS reward_detail

    FROM user_cards uc
    JOIN cards c ON uc.card_id = c.card_id
    JOIN banks b ON c.bank_id = b.bank_id

    LEFT JOIN transaction_payments tp 
      ON tp.card_id = c.card_id
    LEFT JOIN transactions t 
      ON t.transaction_id = tp.transaction_id

    WHERE uc.user_id=$1

    GROUP BY c.card_id, b.name, c.name
    `,
    [uid]
  );

  res.json({
    summary: summary.rows[0],
    cards: cards.rows,
  });
});

module.exports = router;
