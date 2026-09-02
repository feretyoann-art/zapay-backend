module.exports = function (req, res) {
  try {
    // Exemple de réponse (remplace par ton vrai code)
    res.json({
      status: "success",
      message: "Pay endpoint OK",
    });
  } catch (error) {
    console.error("Erreur /api/pay :", error);
    res.status(500).json({
      status: "error",
      message: "Erreur interne serveur",
    });
  }
};
