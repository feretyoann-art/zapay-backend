export default async function handler(req, res) {
  try {
    // 1️⃣ Récupération des paramètres envoyés par Zapay Web / Zapay App
    const {
      amount,
      desc,
      merchant,
      reference,
      iban,
      bic,
      timestamp,
      type
    } = req.method === "POST" ? req.body : req.query;

    // 2️⃣ Vérification des paramètres obligatoires
    if (!amount || !desc || !merchant || !reference || !iban || !bic) {
      return res.status(400).json({
        status: "FAILED",
        message: "Missing parameters"
      });
    }

    // 3️⃣ Vérification dans ta base (exemple simple)
    // ⚠️ À adapter selon ta base (Supabase, Mongo, JSON, etc.)
    const payment = await checkPaymentInDatabase(reference);

    if (!payment) {
      return res.status(200).json({
        status: "NOT_FOUND",
        reference
      });
    }

    // 4️⃣ Vérification du statut réel
    if (payment.status === "PAID") {
      return res.status(200).json({
        status: "PAID",
        amount: payment.amount,
        desc: payment.desc,
        merchant: payment.merchant,
        reference: payment.reference,
        date: payment.date
      });
    }

    // 5️⃣ Si le paiement existe mais pas encore reçu
    return res.status(200).json({
      status: "PENDING",
      reference
    });

  } catch (error) {
    return res.status(500).json({
      status: "FAILED",
      message: error.message
    });
  }
}

// Exemple de fonction de vérification (à adapter)
async function checkPaymentInDatabase(reference) {
  // Ici tu mets ton code réel :
  // - Supabase
  // - MongoDB
  // - JSON local
  // - Vercel KV
  return null; // Par défaut → aucun paiement trouvé
}
