// services/RewardEngine.js
const db = require('../db');
const moment = require('moment'); // 假設您會安裝 moment.js 或使用內建 Date

class RewardEngine {
    constructor() {
        // SQL 查詢片段，用於從 reward_rules 表獲取規則
        this.RULE_FIELDS = `
            rule_id, card_id, percentage, fixed_amount, target_mc_id, target_merchant_id, 
            target_mcc_type, is_exclusion, min_spend_threshold, max_reward_cap,
            cap_period, valuation_rate, start_date, end_date, description, reward_type
        `;
    }

    /**
     * 從資料庫獲取單張卡片的所有回饋規則。
     */
    async fetchCardRules(cardId) {
        const query = `
            SELECT ${this.RULE_FIELDS}
            FROM reward_rules
            WHERE card_id = $1
            ORDER BY is_exclusion DESC, percentage DESC;
        `;
        const { rows } = await db.query(query, [cardId]);
        return rows;
    }

    /**
     * 獲取該卡片在特定週期已累積的回饋淨值（用於 Cap Check）。
     * 這裡我們計算的是淨值，避免不同回饋單位混淆。
     */
    async fetchAccumulatedNetValue(userId, cardId, capPeriod, transactionDate) {
        let dateFilter = '';
        const params = [userId, cardId];

        // 簡化日期邏輯：假設 cap_period 只有 'monthly'
        if (capPeriod === 'monthly') {
            const startOfMonth = moment(transactionDate).startOf('month').toISOString();
            dateFilter = `AND t.transaction_date >= $3`;
            params.push(startOfMonth);
        } else {
             // 其他 cap_period 邏輯
             return 0.0;
        }

        // 這裡需要 JOIN reward_rules 獲取 valuation_rate
        const query = `
            SELECT SUM(tp.reward_amount * rr.valuation_rate) AS accumulated_net_value
            FROM transaction_payments tp
            JOIN transactions t ON tp.transaction_id = t.transaction_id
            JOIN reward_rules rr ON tp.applied_rule_id = rr.rule_id
            WHERE t.user_id = $1 AND tp.card_id = $2 ${dateFilter};
        `;
        const { rows } = await db.query(query, params);
        return parseFloat(rows[0]?.accumulated_net_value || 0);
    }

    /**
     * 核心：計算單張卡片針對單筆消費的回饋淨值。
     * @param {number} userId - 使用者 ID
     * @param {number} cardId - 卡片 ID
     * @param {number} amount - 消費金額
     * @param {number} merchantId - 店家 ID
     * @param {number} mcId - 店家類別 ID (target_mc_id)
     * @param {string} mccType - 通用屬性 (target_mcc_type)
     * @param {string} transactionDate - 交易日期
     * @param {boolean} isDryRun - 是否為模擬計算 (false 時會更新累積 cap)
     */
    async simulateSingleCard(userId, cardId, amount, merchantId, mcId, mccType, transactionDate, isDryRun = true) {
        const rules = await this.fetchCardRules(cardId);
        const dateObj = moment(transactionDate).toDate();

        // 1. 規則過濾與排除檢查 (邏輯同前所述)
        const activeRules = rules.filter(/* ... 排除/時間/門檻過濾邏輯 ... */);
        for (const rule of activeRules) {
            if (rule.is_exclusion && this._isRuleHit(rule, merchantId, mcId, mccType)) {
                return { net_value: 0.0, raw_reward: 0.0, reward_unit: 'cash', description: "命中排除規則，回饋 0" };
            }
        }
        
        // 2. 找出最佳規則 (簡化為找到第一個命中的最高淨值規則)
        const hitRule = activeRules.find(r => this._isRuleHit(r, merchantId, mcId, mccType));
        const bestRule = hitRule || activeRules.find(r => r.target_mcc_type === 'general'); // 找保底規則

        if (!bestRule) {
            return { net_value: 0.0, raw_reward: 0.0, reward_unit: 'cash', description: "未命中任何回饋規則" };
        }

        // 3. 回饋計算與上限檢查 (核心 B1 邏輯)
        let rawReward = this._calculateRawReward(amount, bestRule);
        const valuationRate = bestRule.valuation_rate || 1.0;
        let finalReward = rawReward;
        
        if (bestRule.max_reward_cap && bestRule.cap_period) {
            const accumulatedNet = await this.fetchAccumulatedNetValue(userId, cardId, bestRule.cap_period, dateObj);
            const maxCap = bestRule.max_reward_cap;

            const rawNetValue = rawReward * valuationRate;
            const availableCap = maxCap - accumulatedNet;

            if (availableCap <= 0) {
                finalReward = 0.0;
            } else if (rawNetValue > availableCap) {
                finalReward = availableCap / valuationRate;
            }
        }

        const netValue = finalReward * valuationRate;

        // 4. 回傳結構
        return {
            net_value: netValue,
            raw_reward: finalReward,
            reward_unit: bestRule.reward_type,
            description: bestRule.description,
            applied_rule_id: bestRule.rule_id
        };
    }

    // --- 內部輔助方法 (略過重複的 _isRuleHit 和 _calculateRawReward 實作) ---
}

module.exports = new RewardEngine();
