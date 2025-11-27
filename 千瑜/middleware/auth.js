const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth)
    return res.status(401).json({ error: "UNAUTHORIZED", message: "缺少 token" });

  const token = auth.split(" ")[1];

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "token 無效" });
  }
};
