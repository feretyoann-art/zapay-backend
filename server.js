const express = require("express");
const payHandler = require("./api/pay.js");
const checkHandler = require("./api/check_payment.js");

const app = express();
app.use(express.json());

// Routes
app.get("/api/pay", payHandler);
app.get("/api/check_payment", checkHandler);

// Port Render
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Zapay backend running on port ${port}`);
});
