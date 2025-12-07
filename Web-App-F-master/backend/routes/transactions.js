const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const db = require("../db");


// --- REWARDS ENGINE CORE LOGIC ---
/**
 * 根據卡片、交易分類/店家和金額，查詢 reward_rules 表來計算回饋。
 * @param {number} cardId - 使用的卡片 ID
 * @param {number} mcId - 商家分類 ID (merchant_categories.mc_id)
 * @param {number} merchantId - 商家 ID (merchants.merchant_id)
 * @param {number} amount - 交易金額
 * @param {number} uid - 使用者 ID (用於檢查月回饋上限)
 * @returns {object} 回饋結果物件
 */
async function calculateReward(cardId, mcId, merchantId, amount, uid) {
  // 1. 取得 MCC Type 和卡片資訊
  const [mcResult, cardInfoResult] = await Promise.all([
    // 必須先查出 mcc_type 才能用於優先級最低的規則匹配
    db.query(`SELECT mcc_type FROM merchant_categories WHERE mc_id = $1`, [mcId]),
    db.query(
      `
      SELECT c.name AS card_name, b.name AS bank_name
      FROM cards c JOIN banks b ON c.bank_id = b.bank_id
      WHERE c.card_id = $1
      `,
      [cardId]
    )
  ]);
  
  const cardInfo = cardInfoResult.rows[0] || { card_name: "未知卡", bank_name: "未知銀行" };

  if (mcResult.rows.length === 0) {
    return {
      card_id: cardId, bank_name: cardInfo.bank_name, card_name: cardInfo.card_name,
      reward_mode: "Cash Back", reward_amount: 0.00, reward_value_estimated: 0.00,
      note: "分類ID無效", hit_monthly_cap: false, error: true, message: "分類ID無效"
    };
  }
  const mcc_type = mcResult.rows[0].mcc_type;

  // 2. 尋找最佳匹配的回饋規則 - 整合 CTE 邏輯
  const rewardsQuery = `
    SELECT
        cr.percentage AS reward_rate,
        cr.fixed_amount,                            -- 【新增】固定金額
        cr.reward_type,
        cr.max_reward_cap AS monthly_cap,
        cr.valuation_rate AS cash_value_ratio,
        cr.description AS note
    FROM reward_rules cr  
    WHERE cr.card_id = $1
    -- 1. 檢查交易金額是否達到最低門檻
    AND $5 >= cr.min_spend_threshold
    -- 2. 檢查規則是否適用於當前交易（mc_id, merchant_id, mcc_type 之一匹配，或為保底規則）
    AND (
        cr.target_mc_id = $2                  -- 規則適用於當前分類
        OR cr.target_merchant_id = $3         -- 規則適用於當前店家
        OR cr.target_mcc_type = $4            -- 規則適用於當前類型
        OR (
            -- 規則為通用保底規則
            cr.target_mc_id IS NULL AND 
            cr.target_merchant_id IS NULL AND 
            cr.target_mcc_type IS NULL       
        )
    )
    ORDER BY
        -- 【核心修正點】：依照回饋的「隱藏價值」排序，確保選出價值最高的單一規則
        (
            LEAST(
                COALESCE(cr.max_reward_cap, 999999999), -- 使用大數作為無上限時的替代值
                (
                    CASE 
                        -- 優先使用固定金額 (fixed_amount) 計算
                        WHEN cr.fixed_amount IS NOT NULL THEN cr.fixed_amount 
                        -- 其次使用百分比 (percentage) 計算
                        ELSE ($5 * cr.percentage / 100)
                    END
                )
            ) * cr.valuation_rate
        ) DESC,
        -- 回饋價值相同時，使用精確度打破平局
        CASE WHEN cr.target_mc_id = $2 THEN 1 ELSE 9 END, 
        CASE WHEN cr.target_merchant_id = $3 AND cr.target_mc_id IS NULL THEN 2 ELSE 9 END, 
        CASE WHEN cr.target_mcc_type = $4 AND cr.target_mc_id IS NULL AND cr.target_merchant_id IS NULL THEN 3 ELSE 9 END,
        CASE WHEN cr.target_mc_id IS NULL AND cr.target_merchant_id IS NULL AND cr.target_mcc_type IS NULL THEN 4 ELSE 9 END
    LIMIT 1
  `;
  
  // 查詢參數: [cardId, mcId, merchantId, mcc_type, amount]
  const rewardRuleResult = await db.query(rewardsQuery, [cardId, mcId, merchantId, mcc_type, amount]);

  if (rewardRuleResult.rows.length === 0) {
    // 找不到規則，回傳 0 回饋 
    return {
      card_id: cardId, bank_name: cardInfo.bank_name, card_name: cardInfo.card_name,
      reward_mode: "Cash Back", reward_amount: 0.00, reward_value_estimated: 0.00,
      note: "無有效回饋規則", hit_monthly_cap: false,
    };
  }

  const rule = rewardRuleResult.rows[0];
  const rewardRate = parseFloat(rule.reward_rate); // percentage
  const fixedAmount = rule.fixed_amount ? parseFloat(rule.fixed_amount) : null; // fixed_amount
  const cashValueRatio = parseFloat(rule.cash_value_ratio); // valuation_rate
  const monthlyCap = rule.monthly_cap ? parseFloat(rule.monthly_cap) : null; // max_reward_cap
  const rewardMode = rule.reward_type;

  // 3. 檢查並計算月回饋上限使用量 (B1: monthly cap)
  let hitMonthlyCap = false;
  
  // 根據 fixed_amount 或 percentage 計算原始回饋金額
  let calculatedRewardAmount;
  if (fixedAmount !== null) {
      calculatedRewardAmount = fixedAmount;
  } else {
      // 計算公式已修正：percentage / 100
      calculatedRewardAmount = amount * (rewardRate / 100); 
  }

  // 計算上限截斷
  if (monthlyCap !== null) {
    const currentMonthRewardResult = await db.query(
      `
      -- 查詢本月該卡該回饋模式已累積的回饋數量 (從 transaction_payments 取得)
      SELECT COALESCE(SUM(tp.reward_amount), 0) AS current_reward_sum
      FROM transaction_payments tp
      JOIN transactions t ON tp.transaction_id = t.transaction_id
      WHERE tp.card_id = $1
      AND t.user_id = $2
      AND tp.reward_type = $3
      AND date_trunc('month', t.transaction_date) = date_trunc('month', NOW())
      `,
      [cardId, uid, rewardMode]
    );
    
    const currentRewardSum = parseFloat(currentMonthRewardResult.rows[0].current_reward_sum);
    let remainingCap = monthlyCap - currentRewardSum;
    
    if (remainingCap <= 0) {
        calculatedRewardAmount = 0;
        hitMonthlyCap = true;
    } else if (calculatedRewardAmount > remainingCap) {
        calculatedRewardAmount = remainingCap;
        hitMonthlyCap = true; // 這次交易達上限
    }
  }

  // 4. 計算預估現金價值 (B1: valuation_rate)
  const rewardValueEstimated = calculatedRewardAmount * cashValueRatio;
  
  // 5. 輸出結果
  let noteDetail = fixedAmount !== null ? `定額 ${fixedAmount} ${rewardMode}` : `${rewardRate}% ${rewardMode}`;
  const note = rule.note || noteDetail + (hitMonthlyCap ? ' (已達上限)' : '');

  return {
    card_id: cardId,
    bank_name: cardInfo.bank_name,
    card_name: cardInfo.card_name,
    reward_mode: rewardMode,
    // 【修正點】：將回饋金額和預估價值四捨五入到整數
    reward_amount: Math.round(calculatedRewardAmount),
    reward_value_estimated: Math.round(rewardValueEstimated),
    note: note,
    hit_monthly_cap: hitMonthlyCap,
  };
}
// --- END REWARDS ENGINE CORE LOGIC ---


// B2. POST /transactions/simulate (模擬最佳卡)
router.post("/simulate", auth, async (req, res) => {
  const uid = req.user.user_id;
  // NewTransactionPage.jsx 傳入所有欄位
  const { merchant_id, category_id, amount } = req.body; 

  if (!category_id || !amount || !merchant_id) {
    return res.status(400).json({ error: "MISSING_FIELDS", message: "缺少必要欄位: merchant_id, category_id, amount" });
  }
  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "INVALID_AMOUNT", message: "金額無效" });
  }

  try {
    // 1. 取得使用者持有的卡片 (user_cards 表)
    const userCardsResult = await db.query(
      `
      SELECT card_id
      FROM user_cards
      WHERE user_id = $1
      ORDER BY uc_id
      LIMIT 3
      `,
      [uid]
    );
    const userCardIds = userCardsResult.rows.map(r => r.card_id);

    if (userCardIds.length === 0) {
      return res.status(400).json({ error: "NO_CARDS_SET", message: "請先至卡片設定頁面選擇您持有的卡片" });
    }

    // 2. 針對每張卡片進行回饋模擬 (B2 核心)
    const simulationResults = [];
    let bestCardId = null;
    let maxRewardValue = -1;

    for (const cardId of userCardIds) {
      // 呼叫 DB 驅動的計算邏輯，並傳入 merchant_id (這裡使用原始金額進行計算)
      const reward = await calculateReward(cardId, category_id, merchant_id, numericAmount, uid);
      
      if (reward.error) {
          console.error(`Simulation error for card ${cardId}: ${reward.message}`);
          continue; 
      }
      
      simulationResults.push(reward);

      // 找出最佳卡片 (以 estimated value 為準)
      if (reward.reward_value_estimated > maxRewardValue) {
        maxRewardValue = reward.reward_value_estimated;
        bestCardId = cardId;
      }
    }
    
    if (simulationResults.length === 0) {
        return res.status(404).json({ error: "NO_REWARDS_FOUND", message: "沒有卡片或有效的回饋規則可供模擬" });
    }

    res.json({
      best_card_id: bestCardId,
      cards: simulationResults,
    });

  } catch (err) {
    console.error("Error during reward simulation:", err);
    res.status(500).json({ error: "SIMULATION_FAILED", message: "回饋模擬計算失敗" });
  }
});


// B3. POST /transactions (實際交易 - 建立交易紀錄)
router.post("/", auth, async (req, res) => {
  const uid = req.user.user_id;
  // 前端 NewTransactionPage.jsx 傳入所有欄位
  const { merchant_id, category_id, amount, used_card_id, transaction_date } = req.body;

  if (!merchant_id || !category_id || !amount || !used_card_id) {
    return res.status(400).json({ error: "MISSING_FIELDS", message: "缺少必要欄位" });
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "INVALID_AMOUNT", message: "金額無效" });
  }

  // 【修正點】：將交易金額四捨五入為整數，用於資料庫寫入
  const integerAmount = Math.round(numericAmount); 
  
  let productId = null;
  
  // 1. 根據 category_id (mc_id) 查詢一個 product_id (為符合 transactions 表結構)
  try {
    const productResult = await db.query(
      `
      SELECT p.product_id
      FROM products p
      WHERE p.mc_id = $1
      LIMIT 1
      `,
      [category_id]
    );

    if (productResult.rows.length === 0) {
        // 為了確保交易能寫入，如果找不到對應的產品，可考慮使用一個預設產品ID
        console.warn(`No product found for category_id ${category_id}. Using fallback product logic is recommended.`);
        // 如果允許交易無產品ID，這裡邏輯需調整
        return res.status(400).json({ error: "NO_PRODUCT_FOUND", message: "此分類下無可用產品，無法建立交易" });
    }
    productId = productResult.rows[0].product_id;
  } catch (err) {
      console.error("Error finding product ID:", err);
      return res.status(500).json({ error: "DB_ERROR", message: "查詢產品資料失敗" });
  }


  try {
    // 2. 計算實際回饋 (B1 核心)
    // 傳入原始金額進行計算，但輸出會是整數 (已在 calculateReward 內修正)
    const reward = await calculateReward(used_card_id, category_id, merchant_id, numericAmount, uid);
    
    if (reward.error) {
        return res.status(400).json({ error: "REWARD_CALC_ERROR", message: reward.message });
    }
    
    // 開始資料庫事務
    await db.query('BEGIN');

    // 3. 交易寫入 transactions 表
    const transactionResult = await db.query(
      `
      INSERT INTO transactions (user_id, product_id, amount, transaction_date)
      VALUES ($1, $2, $3, $4)
      RETURNING transaction_id
      `,
      [
        uid,
        productId,
        integerAmount, // 【修正點】：使用整數金額
        transaction_date || new Date().toISOString().split('T')[0] 
      ]
    );
    const transactionId = transactionResult.rows[0].transaction_id;

    // 4. 回饋寫入 transaction_payments 表 (B3 核心)
    await db.query(
      `
      INSERT INTO transaction_payments (transaction_id, card_id, reward_type, reward_amount, amount)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        transactionId,
        reward.card_id,
        reward.reward_mode,
        reward.reward_amount, // 輸出已是整數
        integerAmount       // 【修正點】：使用整數金額
      ]
    );

    // 提交事務
    await db.query('COMMIT');

    // 5. 回傳建立成功的資料
    res.json({
        transaction_id: transactionId,
        date: (transaction_date || new Date().toISOString().split('T')[0]),
        amount: integerAmount, // 回傳整數金額
        card_name: reward.card_name, 
        reward_mode: reward.reward_mode, 
        reward_amount: reward.reward_amount, 
    });

  } catch (err) {
    // 錯誤時回滾事務
    await db.query('ROLLBACK');
    console.error("Error creating transaction:", err);
    res.status(500).json({ error: "CREATION_FAILED", message: "建立交易紀錄失敗" });
  }
});


// A6. GET /transactions (查詢使用者所有消費紀錄) - 沿用邏輯
router.get("/", auth, async (req, res) => {
  const uid = req.user.user_id;
  const limit = Number(req.query.limit || 10);
  const page = Number(req.query.page || 1);
  const offset = (page - 1) * limit;

  // 篩選參數
  const year = Number(req.query.year || new Date().getFullYear());
  const month = Number(req.query.month || new Date().getMonth() + 1);
  const mcc_type = req.query.mcc_type || null;
  const card_name = req.query.card_name || null;

  // -------------------------------
  // 處理卡片名稱篩選
  // -------------------------------
  let card_id = null;
  if (card_name) {
    const cardResult = await db.query(
      `SELECT card_id FROM cards WHERE name = $1`,
      [card_name]
    );

    if (cardResult.rows.length > 0) {
      card_id = cardResult.rows[0].card_id;
    } else {
      return res.json({
        recent_transactions: [],
        page, limit, total: 0,
        filter: { year, month, mcc_type, card_name, card_id: null }
      });
    }
  }

  // -------------------------------
  // 動態 WHERE 條件
  // -------------------------------
  const conditions = [`t.user_id = $${1}`];
  const params = [uid];
  let paramIndex = 2;

  if (year && month) {
    conditions.push(`date_trunc('month', t.transaction_date) = $${paramIndex}`);
    params.push(`${year}-${String(month).padStart(2, '0')}-01`);
    paramIndex++;
  } else if (year) {
    conditions.push(`date_trunc('year', t.transaction_date) = $${paramIndex}`);
    params.push(`${year}-01-01`);
    paramIndex++;
  }

  if (mcc_type) {
    conditions.push(`mc.mcc_type = $${paramIndex}`);
    params.push(mcc_type);
    paramIndex++;
  }

  if (card_id) {
    conditions.push(`tp.card_id = $${paramIndex}`);
    params.push(card_id);
    paramIndex++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // ----------------------
  // 主要資料查詢 (使用 transaction_payments 進行 JOIN)
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
    SELECT COUNT(DISTINCT t.transaction_id)
    FROM transactions t
    JOIN products p ON t.product_id = p.product_id
    JOIN merchant_categories mc ON p.mc_id = mc.mc_id
    LEFT JOIN transaction_payments tp ON t.transaction_id = tp.transaction_id
    LEFT JOIN cards c ON tp.card_id = c.card_id
    ${where}
    `,
    params
  );

  res.json({
    recent_transactions: result.rows.map(tx => ({
        ...tx,
        amount: Number(tx.amount), // 確保輸出為數字
        reward_amount: Number(tx.reward_amount)
    })),
    page,
    limit,
    total: Number(total.rows[0].count),
    filter: { year, month, mcc_type, card_name, card_id }
  });
});

module.exports = router;