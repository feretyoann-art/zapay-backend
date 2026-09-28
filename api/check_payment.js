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

    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    );

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("id", { ascending: false })
      .limit(1);

    if (error) {
      console.error(
        "Erreur Supabase check_payment :",
        error
      );

      return res.status(500).json({
        status: "error",
        paid: false,
        message: "Erreur lors de la vérification du paiement",
        error: error.message,
      });
    }

    if (!data || data.length === 0) {
      return res.status(200).json({
        status: "success",
        paid: false,
        message: "Aucun paiement trouvé",
      });
    }

    const latestPayment = data[0];

    return res.status(200).json({
      status: "success",
      paid: latestPayment.paid,
      amount: latestPayment.amount,
      desc: latestPayment.desc,
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
