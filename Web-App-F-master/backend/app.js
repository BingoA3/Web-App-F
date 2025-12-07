// 主入口

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/user", require("./routes/user"));
app.use("/api/cards", require("./routes/cards"));
app.use("/api/mcc_types", require("./routes/mcc_types"));
app.use("/api/user/cards", require("./routes/userCards"));
app.use("/api/merchants", require("./routes/merchants"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/dashboard", require("./routes/dashboard"));

app.listen(3000, () => {
  console.log("Backend A running at http://localhost:3000");
});
