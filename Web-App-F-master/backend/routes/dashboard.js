const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const db = require("../db");



router.get("/", auth, async (req, res) => {

  const uid = req.user.user_id;



  /* =============================

     SUMMARY：本月總消費與總回饋值 (A7 需求)

     ============================= */

  const summary = await db.query(

    `

    SELECT 

      -- 本月總消費

      COALESCE(SUM(t.amount), 0)::NUMERIC AS current_month_spending,

      -- 本月估計總回饋值 (假設 transaction_payments.reward_amount 已經是等值回饋)

      COALESCE(SUM(tp.reward_amount), 0)::NUMERIC AS current_month_rewards_value

    FROM transactions t

    -- 為了計算回饋總值，需要 JOIN transaction_payments

    LEFT JOIN transaction_payments tp ON t.transaction_id = tp.transaction_id

    WHERE t.user_id = $1

      AND date_trunc('month', t.transaction_date) = date_trunc('month', CURRENT_DATE)

    `,

    [uid]

  );

  

  /* =============================

    【新增】TOTAL REWARD SUMMARY：本月總回饋數量按類型

    ============================= */

  const totalRewardSummary = await db.query(

    `

    SELECT

      tp.reward_type AS reward_mode,

      -- 【修正】：將 reward_quantity 改回 reward_amount

      COALESCE(SUM(tp.reward_amount), 0)::NUMERIC AS total_reward

    FROM transactions t

    JOIN transaction_payments tp ON t.transaction_id = tp.transaction_id

    WHERE t.user_id = $1

      AND date_trunc('month', t.transaction_date) = date_trunc('month', CURRENT_DATE)

    GROUP BY tp.reward_type

    `,

    [uid]

  );



  /* =============================

     CARDS：卡片資訊 + 本月消費 + 回饋明細 (B4: 每張卡詳細數據)

     ============================= */



     const cards = await db.query(



      `

  

      SELECT

  

        c.card_id,

  

        b.name AS bank_name,

  

        c.name AS card_name,

  

  

  

      -- 本月消費金額 (修正為使用 t.amount)

  

      COALESCE(SUM(CASE

  

          WHEN date_trunc('month', t.transaction_date) = date_trunc('month', CURRENT_DATE) 

  

          THEN t.amount 

  

          ELSE 0 

  

      END), 0)::NUMERIC AS month_spending,

  

      

  

      -- 累積總回饋等值現金

  

      COALESCE(SUM(CASE

  

          WHEN date_trunc('month', t.transaction_date) = date_trunc('month', CURRENT_DATE) 

  

          THEN tp.reward_amount 

  

          ELSE 0 

  

      END), 0)::NUMERIC AS total_rewards_gained,

  

  

  

        COALESCE(

  

          (

  

            SELECT JSON_AGG(

  

              JSON_BUILD_OBJECT(

  

                'reward_mode', rt.reward_type,

  

                'total_reward', rt.total_reward

  

              )

  

            )

  

            FROM (

  

              SELECT 

  

                tp2.reward_type,

                -- 【修正】：將 reward_quantity 改回 reward_amount

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

  

      ORDER BY c.card_id

  

      `,

  

      [uid]

  

    );    



  /* =============================

   RECENT TRANSACTIONS：近期消費紀錄 (A7 需求)

   ============================= */

  // ★ 新增這段邏輯

  const recentTransactions = await db.query(

    `

    SELECT

      t.transaction_id,

      to_char(t.transaction_date, 'YYYY-MM-DD') AS date,

      m.name AS merchant_name,

      mc.name AS category_name,

      t.amount,

      c.name AS card_name,

      tp.reward_type AS reward_mode,

      tp.reward_amount AS reward_amount -- 【修正】：將 reward_quantity 改回 reward_amount

    FROM transactions t

    -- 交易紀錄的 JOIN 方式參考 get_transactions.js

    JOIN products p ON t.product_id = p.product_id

    JOIN merchant_categories mc ON p.mc_id = mc.mc_id

    JOIN merchants m ON mc.merchant_id = m.merchant_id

    LEFT JOIN transaction_payments tp ON tp.transaction_id = t.transaction_id

    LEFT JOIN cards c ON tp.card_id = c.card_id

    WHERE t.user_id = $1 

    ORDER BY t.transaction_date DESC, t.transaction_id DESC

    LIMIT 10

    `,

    [uid]

  );



  // ★ 確保三個欄位都回傳

  res.json({

    // 【修正】：將 summaryResult 和 totalRewardSummary 合併

    summary: {

        ...summary.rows[0],

        total_reward_summary: totalRewardSummary.rows,

    },

    cards: cards.rows,

    recent_transactions: recentTransactions.rows, // 成功加入

  });

});





module.exports = router;
