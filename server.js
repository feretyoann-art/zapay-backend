import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Import de tes handlers
import payHandler from "./api/pay.js";
import checkHandler from "./api/check_payment.js";

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
