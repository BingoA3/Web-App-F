// routes/rewards.js
const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const rewardEngine = require('../services/RewardEngine');
const db = require('../db');

// --- 🔴 B2. 模擬最佳卡 API ---
// POST /api/rewards/simulate
router.post('/simulate', authMiddleware, async (req, res) => {
    const userId = req.user.user_id;
    
    // 欄位對應: 前端 Add Transaction 頁面輸入
    const { amount, merchant_id, category_id, mcc_type, transaction_date } = req.body;

    if (!amount || !transaction_date) {
        return res.status(400).json({ error: "INVALID_INPUT", message: "缺少金額或日期" });
    }

    try {
        // 從 routes/userCards.js 的 DB 邏輯中獲取卡片資訊
        const userCardsQuery = `
            SELECT uc.card_id, c.name AS card_name, b.name AS bank_name
            FROM user_cards uc
            JOIN cards c ON uc.card_id = c.card_id
            JOIN banks b ON c.bank_id = b.bank_id
            WHERE uc.user_id = $1;
        `;
        const { rows: userCards } = await db.query(userCardsQuery, [userId]);
        
        const comparisonResults = [];

        for (const card of userCards) {
            const result = await rewardEngine.simulateSingleCard(
                userId, card.card_id, amount, merchant_id, category_id, mcc_type, transaction_date, true 
            );

            comparisonResults.push({
                card_id: card.card_id,
                bank_name: card.bank_name,
                card_name: card.card_name,
                net_value: parseFloat(result.net_value.toFixed(2)),
                reward_mode: result.reward_unit, // 回饋單位
                reward_amount: parseFloat(result.raw_reward.toFixed(2)), // 實際回饋量
                description: result.description,
            });
        }

        const bestCard = comparisonResults.reduce((max, card) => 
            (max.net_value > card.net_value ? max : card), { net_value: -Infinity }
        );

        res.json({
            best_card_id: bestCard.card_id,
            best_net_value: bestCard.net_value,
            best_card_name: bestCard.card_name,
            comparison: comparisonResults
        });

    } catch (error) {
        console.error('Simulation Error:', error);
        res.status(500).json({ error: "SIMULATION_FAILED", message: "模擬計算失敗" });
    }
});

// --- 🔴 B4. 累積回饋統計輔助函式 (供 routes/dashboard.js 引用) ---
/**
 * 這是 B 模組的數據源，將被 A 模組（/dashboard）引用。
 * 負責計算每張卡的累積回饋明細。
 */
router.getRewardsSummaryForDashboard = async (userId) => {
    // 查詢 transaction_payments 表格，統計本月的回饋總額 (raw amount)
    // 為了和隊友的 dashboard.js 結構匹配，我們只計算 reward_amount 和 reward_type
    const query = `
        SELECT 
            tp.card_id, 
            c.name AS card_name,
            b.name AS bank_name,
            tp.reward_type AS reward_mode,
            SUM(tp.reward_amount) AS total_reward_amount
        FROM transaction_payments tp
        JOIN transactions t ON tp.transaction_id = t.transaction_id
        JOIN cards c ON tp.card_id = c.card_id
        JOIN banks b ON c.bank_id = b.bank_id
        WHERE t.user_id = $1 AND date_trunc('month', t.transaction_date) = date_trunc('month', CURRENT_DATE)
        GROUP BY tp.card_id, c.name, b.name, tp.reward_type;
    `;
    const { rows } = await db.query(query, [userId]);
    
    // 重新格式化成隊友 dashboard.js 期望的結構
    const cardsMap = new Map();
    rows.forEach(row => {
        if (!cardsMap.has(row.card_id)) {
            cardsMap.set(row.card_id, {
                card_id: row.card_id,
                bank_name: row.bank_name,
                card_name: row.card_name,
                month_spending: 0, // 由 dashboard.js 補齊
                reward_detail: []
            });
        }
        cardsMap.get(row.card_id).reward_detail.push({
            reward_mode: row.reward_mode,
            reward_amount: parseFloat(row.total_reward_amount.toFixed(2))
        });
    });

    return Array.from(cardsMap.values());
};

module.exports = router;