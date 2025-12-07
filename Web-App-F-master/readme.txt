先去env文件把密碼跟資料庫名稱改成你電腦上的，接著把資料庫的東西灌一灌(指令在最下面)，甚麼銀行信用卡購物類型回饋規則跟具體商品等等等的都要灌
，不灌跑不了


開兩個terminal分別打以下指令
前端步驟:
1. cd front 
2. npm install
3. npm run dev
(理論上跳這個
  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help)

後端步驟:
1. cd backend
2. node app.js
(理論上跳這個Backend A running at http://localhost:3000)



/*-------------------------------------------------------------------------------

灌資料指令範例:
銀行
INSERT INTO banks (bank_id, name, code) 
VALUES (1, '花旗銀行', 'CITI');
INSERT INTO banks (bank_id, name, code) 
VALUES (2, '中國信託', 'CTBC');



卡片
INSERT INTO cards (card_id, bank_id, name, annual_fee) 
VALUES (100, 1, '花旗現金回饋卡', 0);
INSERT INTO cards (card_id, bank_id, name, annual_fee) 
VALUES (101, 2, '中信LINE Pay卡', 0);
INSERT INTO cards (card_id, bank_id, name, annual_fee) 
VALUES (102, 1, '花旗旅遊卡', 0);



店家 (Merchant)
INSERT INTO merchants (merchant_id, name, is_online) 
VALUES (10, '蘋果官方商店', TRUE);  -- 用於測試 merchant_id 匹配
INSERT INTO merchants (merchant_id, name, is_online) 
VALUES (11, '王品集團', FALSE);      -- 用於測試 mcc_type 匹配



商家分類 (Merchant Categories)
-- mc_id 5: 3C/電子產品 (用於測試 mc_id 匹配)
INSERT INTO merchant_categories (mc_id, merchant_id, name, mcc_type) 
VALUES (5, 10, '3C/電子產品', 'general'); 
-- mc_id 6: 高級餐廳 (用於測試 mcc_type 匹配: dining)
INSERT INTO merchant_categories (mc_id, merchant_id, name, mcc_type) 
VALUES (6, 11, '高級餐廳', 'dining'); 



產品 (Products)
-- Product ID 4: iPhone 
INSERT INTO public.products (product_id, mc_id, name, default_price) 
VALUES (4, 5, 'iPhone 15 Pro', 36000); 
-- mc_id 5 的預設商品 (Fallback Product)
INSERT INTO public.products (mc_id, name, default_price) 
VALUES (5, '預設服務/商品 (mc_id: 5)', 100);
-- mc_id 6 的預設商品 (Fallback Product)
INSERT INTO public.products (mc_id, name, default_price) 
VALUES (6, '預設餐點 (mc_id: 6)', 500);



回饋規則 (Reward Rules)
-- A. Card 100: 一般消費保底規則 (1% 現金回饋)
INSERT INTO reward_rules (
    card_id, description, percentage, fixed_amount, reward_type, 
    max_reward_cap, min_spend_threshold, valuation_rate,
    target_mc_id, target_merchant_id, target_mcc_type
) VALUES (
    100, '一般消費 1% 現金 (保底)', 1.0, NULL, 'cash', 
    NULL, 0, 1.0, 
    NULL, NULL, NULL -- 匹配目標皆為 NULL，為保底規則
);
-- B. Card 101: 針對 mc_id=5 的規則 (5% 點數回饋, 設有低消與上限)
INSERT INTO reward_rules (
    card_id, description, percentage, fixed_amount, reward_type, 
    max_reward_cap, min_spend_threshold, valuation_rate,
    target_mc_id, target_merchant_id, target_mcc_type
) VALUES (
    101, '3C/電子產品 5% 點數', 5.0, NULL, 'points', 
    1000, 1000, 0.8, 
    5, NULL, NULL -- 匹配 mc_id = 5
);
-- C. Card 100: 針對特定店家 (Merchant ID 10) 的固定金額規則 (單筆折抵)
INSERT INTO reward_rules (
    card_id, description, percentage, fixed_amount, reward_type, 
    max_reward_cap, min_spend_threshold, valuation_rate,
    target_mc_id, target_merchant_id, target_mcc_type
) VALUES (
    100, '蘋果商店 單筆固定折抵 50 元', NULL, 50, 'cash', 
    NULL, 500, 1.0, 
    NULL, 10, NULL -- 匹配 merchant_id = 10，且設有 500 元低消
);
-- D. Card 102: 針對 MCC 類型 (dining) 的高回饋規則 (里程)
INSERT INTO reward_rules (
    card_id, description, percentage, fixed_amount, reward_type, 
    max_reward_cap, min_spend_threshold, valuation_rate,
    target_mc_id, target_merchant_id, target_mcc_type
) VALUES (
    102, '餐廳類 8% 里程回饋', 8.0, NULL, 'miles', 
    5000, 0, 0.5, 
    NULL, NULL, 'dining' -- 匹配 mcc_type = 'dining'，且設有 5000 里程上限
);
-------------------------------------------------------------------------------*/