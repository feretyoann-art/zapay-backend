const { createClient } = require("@supabase/supabase-js");

async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error(
        "Configuration Supabase manquante dans pay.js"
      );

      return res.status(500).json({
        success: false,
        message: "Configuration Supabase manquante",
      });
    }

    const { amount, desc } = req.query;

    if (!amount || !desc) {
      return res.status(400).json({
        success: false,
        message: "Montant ou description manquant",
      });
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    );

    const { data, error } = await supabase
      .from("payments")
      .insert({
        paid: false,
        amount,
        desc,
      })
      .select("id, paid, amount, desc")
      .single();

    if (error) {
      console.error(
        "Erreur Supabase pay :",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Erreur lors de l'enregistrement du paiement",
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Paiement créé",
      payment: {
        id: data.id,
        paid: data.paid,
        amount: data.amount,
        desc: data.desc,
      },
    });
  } catch (error) {
    console.error(
      "Erreur serveur pay :",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Erreur interne du serveur",
    });
  }
}

module.exports = handler;
