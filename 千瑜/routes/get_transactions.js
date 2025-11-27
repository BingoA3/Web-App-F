const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const db = require("../db");

router.get("/", auth, async (req, res) => {
  const limit = Number(req.query.limit || 10);
  const page = Number(req.query.page || 1);
  const offset = (page - 1) * limit;

  // 預設篩選
  const year = Number(req.query.year || 2025);
  const month = Number(req.query.month || 11);
  const mcc_type = req.query.mcc_type || null;

  // -------------------------------
  // ★ 卡片名稱 → card_id (關鍵功能)
  // -------------------------------
  let card_id = null;
  const card_name = req.query.card_name || null;

  if (card_name) {
    const cardResult = await db.query(
      `SELECT card_id FROM cards WHERE name = $1`,
      [card_name]
    );

    if (cardResult.rows.length > 0) {
      card_id = cardResult.rows[0].card_id;
    } else {
      // 找不到卡片 → 回傳空結果
      return res.json({
        recent_transactions: [],
        page,
        limit,
        total: 0,
        filter: {
          year,
          month,
          mcc_type,
          card_name,
          card_id: null
        }
      });
    }
  }

  // 動態 WHERE 與參數
  let where = `WHERE t.user_id=$1`;
  const params = [req.user.user_id];
  let i = 2;

  // 年
  where += ` AND EXTRACT(YEAR FROM t.transaction_date) = $${i}`;
  params.push(year);
  i++;

  // 月
  where += ` AND EXTRACT(MONTH FROM t.transaction_date) = $${i}`;
  params.push(month);
  i++;

  // mcc_type
  if (mcc_type) {
    where += ` AND mc.mcc_type = $${i}`;
    params.push(mcc_type);
    i++;
  }

  // ★ 卡片（使用剛查到的 card_id）
  if (card_id) {
    where += ` AND c.card_id = $${i}`;
    params.push(card_id);
    i++;
  }

  // ----------------------
  // 主要資料查詢
  // ----------------------
  const result = await db.query(
    `
    SELECT
      t.transaction_id,
      to_char(t.transaction_date, 'YYYY-MM-DD') AS date,
      m.name AS merchant_name,
      mc.name AS category_name,
      p.name AS product_name,
      t.amount,
      c.name AS card_name,
      tp.reward_type AS reward_mode,
      tp.reward_amount AS reward_amount
    FROM transactions t
    JOIN products p ON t.product_id = p.product_id
    JOIN merchant_categories mc ON p.mc_id = mc.mc_id
    JOIN merchants m ON mc.merchant_id = m.merchant_id
    LEFT JOIN transaction_payments tp ON tp.transaction_id = t.transaction_id
    LEFT JOIN cards c ON tp.card_id = c.card_id
    ${where}
    ORDER BY t.transaction_date DESC
    LIMIT ${limit} OFFSET ${offset}
    `,
    params
  );

  // ----------------------
  // 總筆數
  // ----------------------
  const total = await db.query(
    `
    SELECT COUNT(*)
    FROM transactions t
    JOIN products p ON t.product_id = p.product_id
    JOIN merchant_categories mc ON p.mc_id = mc.mc_id
    LEFT JOIN transaction_payments tp ON t.transaction_id = tp.transaction_id
    LEFT JOIN cards c ON tp.card_id = c.card_id
    ${where}
    `,
    params
  );

  // 回傳
  res.json({
    recent_transactions: result.rows,
    page,
    limit,
    total: Number(total.rows[0].count),
    filter: {
      year,
      month,
      mcc_type,
      card_name,
      card_id
    }
  });
});

module.exports = router;
