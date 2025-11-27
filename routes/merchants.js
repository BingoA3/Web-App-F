const express = require("express");
const router = express.Router();
const db = require("../db");

// ➊ 取得所有商家
router.get("/", async (_, res) => {
  const result = await db.query(`
    SELECT 
      merchant_id,
      name AS merchant_name
    FROM merchants
    ORDER BY merchant_id
  `);

  res.json(result.rows);
});

// ➋ 取得某商家的所有分類
router.get("/:merchantId/categories", async (req, res) => {
  const { merchantId } = req.params;

  const result = await db.query(
    `
    SELECT
      mc_id AS category_id,
      name AS category_name
    FROM merchant_categories
    WHERE merchant_id = $1
    ORDER BY mc_id
    `,
    [merchantId]
  );

  res.json(result.rows);
});

// ➌ 取得某商家某分類的所有產品
router.get("/:merchantId/categories/:categoryId/products", async (req, res) => {
  const { merchantId, categoryId } = req.params;

  const result = await db.query(
    `
    SELECT 
      p.product_id,
      p.name AS product_name,
      p.default_price
    FROM products p
    JOIN merchant_categories mc
      ON p.mc_id = mc.mc_id
    WHERE mc.merchant_id = $1
      AND mc.mc_id = $2
    ORDER BY p.product_id
    `,
    [merchantId, categoryId]
  );

  res.json(result.rows);
});

module.exports = router;
