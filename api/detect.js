export default async function handler(req, res) {
  try {
    const {
      amount,
      desc,
      merchant,
      iban,
      bic
    } = req.method === "POST" ? req.body : req.query;

    // Vérification minimale
    if (!amount || !desc || !merchant || !iban || !bic) {
      return res.status(400).json({
        status: "FAILED",
        message: "Missing parameters"
      });
    }

    // Pour l'instant → pas de base de données
    return res.status(200).json({
      status: "PENDING",
      amount,
      desc,
      merchant
    });

  } catch (error) {
    return res.status(500).json({
      status: "FAILED",
      message: error.message
    });
  }
}
