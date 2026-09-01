export default function handler(req, res) {
  const amount = req.query.amount;
  const desc = req.query.desc;

  const key = amount + "_" + desc;

  // Simule un paiement validé
  globalThis[key] = true;

  res.status(200).json({ success: true });
}
