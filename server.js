const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// Import de tes handlers
const payHandler = require("./api/pay.js");
const checkHandler = require("./api/check_payment.js");

// Routes API existantes
app.get("/api/pay", payHandler);
app.get("/api/check_payment", checkHandler);

// --- Webhook paiement ---
app.post("/webhook/payment", (req, res) => {
  console.log("Webhook reçu :", req.body);
  res.status(200).json({ status: "ok" });
});

// Port Render
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Zapay backend running on port ${port}`);
});
