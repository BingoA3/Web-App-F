// routes/transactions.js
const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const rewardEngine = require('../services/RewardEngine');
const db = require('../db');
const moment = require('moment');

// --- 🔴 B3. 實際交易寫入 API ---
// POST /api/transactions
router.post('/', authMiddleware, async (req, res) => {
    const userId = req.user.user_id;
    // 從 Request Body 獲取所有交易相關 ID
    const { card_id, amount, merchant_id, category_id, product_id, mcc_type } = req.body;
    
    // 基礎驗證
    if (!card_id || !amount || !merchant_id || !category_id) {
        return res.status(400).json({ error: "INVALID_INPUT", message: "缺少必要交易資訊" });
    }

    // 統一使用toISOString() 格式
    const transactionDate = moment().toISOString(); 

    try {
        // 1. 呼叫核心計算引擎 (isDryRun=false -> 實際計算並觸發 Cap 檢查)
        const rewardResult = await rewardEngine.simulateSingleCard(
            userId, card_id, amount, merchant_id, category_id, mcc_type, transactionDate, false
        );
        
        // 2. 寫入 transactions 表
        const transactionQuery = `
            INSERT INTO transactions (user_id, card_id, amount, merchant_id, product_id, transaction_date)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING transaction_id;
        `;
        const transactionValues = [userId, card_id, amount, merchant_id, product_id, transactionDate];
        const transactionRes = await db.query(transactionQuery, transactionValues);
        const transactionId = transactionRes.rows[0].transaction_id;

        // 3. 寫入 transaction_payments 表 (匹配隊友的資料表結構)
        const rewardQuery = `
            INSERT INTO transaction_payments (transaction_id, card_id, reward_type, reward_amount, applied_rule_id)
            VALUES ($1, $2, $3, $4, $5);
        `;
        const rewardValues = [
            transactionId, 
            card_id, 
            rewardResult.reward_unit, // reward_type
            rewardResult.raw_reward,   // reward_amount
            rewardResult.applied_rule_id // 紀錄是哪條規則生效
        ];
        await db.query(rewardQuery, rewardValues);

        res.status(201).json({
            status: "success",
            transaction_id: transactionId,
            reward_details: {
                reward_mode: rewardResult.reward_unit,
                reward_amount: parseFloat(rewardResult.raw_reward.toFixed(2)),
                net_value: parseFloat(rewardResult.net_value.toFixed(2)),
                description: rewardResult.description
            }
        });

    } catch (error) {
        console.error('Transaction Write Error:', error);
        res.status(500).json({ error: "TRANSACTION_FAILED", message: "交易寫入失敗" });
    }
});

module.exports = router;