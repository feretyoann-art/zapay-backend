const { createClient } = require("@supabase/supabase-js");

async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error(
        "Configuration Supabase manquante dans check_payment.js"
      );

      return res.status(500).json({
        status: "error",
        paid: false,
        message: "Configuration Supabase manquante",
      });
    }

    // ------------------------------------
    // UUID DU PAIEMENT À VÉRIFIER
    // ------------------------------------
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        status: "error",
        paid: false,
        message: "ID paiement manquant",
      });
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    );

    // ------------------------------------
    // RECHERCHE DU PAIEMENT PAR UUID
    // ------------------------------------
    const { data, error } = await supabase
      .from("payments")
      .select("id, paid, amount, desc")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error(
        "Erreur Supabase check_payment :",
        error
      );

      return res.status(500).json({
        status: "error",
        paid: false,
        message:
          "Erreur lors de la vérification du paiement",
        error: error.message,
      });
    }

    // ------------------------------------
    // PAIEMENT INTROUVABLE
    // ------------------------------------
    if (!data) {
      return res.status(404).json({
        status: "error",
        paid: false,
        message: "Paiement introuvable",
      });
    }

    // ------------------------------------
    // PAIEMENT TROUVÉ
    // ------------------------------------
    return res.status(200).json({
      status: "success",
      id: data.id,
      paid: data.paid,
      amount: data.amount,
      desc: data.desc,
    });
  } catch (error) {
    console.error(
      "Erreur serveur check_payment :",
      error
    );

    return res.status(500).json({
      status: "error",
      paid: false,
      message: "Erreur interne du serveur",
    });
  }
}

module.exports = handler;
