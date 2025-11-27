const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

router.post("/signup", async (req, res) => {
  const { email, password, display_name } = req.body;

  const exists = await db.query(`SELECT * FROM users WHERE email=$1`, [email]);
  if (exists.rows.length > 0)
    return res.status(400).json({
      error: "EMAIL_TAKEN",
      message: "此 Email 已被註冊"
    });

  // ★ 不做 bcrypt，加密
  const result = await db.query(
    `
    INSERT INTO users (username, email, password)
    VALUES ($1, $2, $3)
    RETURNING user_id, username AS display_name, email
    `,
    [display_name, email, password]
  );

  const user = result.rows[0];
  const token = jwt.sign(user, process.env.JWT_SECRET);

  res.json({ ...user, token });
});


router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await db.query(`SELECT * FROM users WHERE email=$1`, [email]);

  if (result.rows.length === 0)
    return res.status(401).json({
      error: "INVALID_CREDENTIALS",
      message: "Email 或密碼錯誤"
    });

  const user = result.rows[0];

  // ★ 明文比對
  if (user.password !== password)
    return res.status(401).json({
      error: "INVALID_CREDENTIALS",
      message: "Email 或密碼錯誤"
    });

  const token = jwt.sign(
    {
      user_id: user.user_id,
      display_name: user.username,
      email: user.email
    },
    process.env.JWT_SECRET
  );

  res.json({
    user_id: user.user_id,
    display_name: user.username,
    email: user.email,
    token
  });
});

module.exports = router;