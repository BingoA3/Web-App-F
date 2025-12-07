const express = require("express");

const router = express.Router();

const db = require("../db");

const auth = require("../middleware/auth"); 



// 取得所有商家類別（包含 merchant_id 供前端篩選使用）

router.get("/", auth, async (_, res) => {

  try {

    // 【核心修正】：將 SQL 查詢字串的開頭縮排和換行移除，避免 'position: 2' 錯誤

    const result = await db.query(`SELECT 

        mc_id AS category_id,

        name AS category_name,

        merchant_id

      FROM merchant_categories

      ORDER BY mc_id

    `);



    res.json(result.rows);

  } catch (error) {

    console.error("Error fetching categories:", error);

    res.status(500).json({ error: "Failed to fetch categories" });

  }

});



module.exports = router;