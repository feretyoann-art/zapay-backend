const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const {
  createHmac,
  timingSafeEqual,
} = require("node:crypto");

const app = express();

// ------------------------------------
// CONFIGURATION
// ------------------------------------
const port = process.env.PORT || 3000;

const hmacSecret = process.env.ZAPAY_HMAC_SECRET;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Tolérance maximale contre le rejeu.
const WEBHOOK_MAX_AGE_SECONDS = 300;

// ------------------------------------
// HANDLERS API EXISTANTS
// ------------------------------------
const payHandler = require("./api/pay.js");
const checkHandler = require("./api/check_payment.js");

// ------------------------------------
// FONCTIONS HMAC
// ------------------------------------

function isValidHexSignature(signature) {
  return (
    typeof signature === "string" &&
    /^[0-9a-f]{64}$/i.test(signature)
  );
}

function isValidTimestamp(timestamp) {
  if (typeof timestamp !== "string") {
    return false;
  }

  const timestampNumber = Number(timestamp);

  if (!Number.isFinite(timestampNumber)) {
    return false;
  }

  const currentTimestamp = Math.floor(
    Date.now() / 1000
  );

  const requestAge = Math.abs(
    currentTimestamp - timestampNumber
  );

  return requestAge <= WEBHOOK_MAX_AGE_SECONDS;
}

function verifyWebhookSignature({
  rawBody,
  timestamp,
  receivedSignature,
}) {
  if (!hmacSecret) {
    console.error(
      "Variable ZAPAY_HMAC_SECRET manquante dans Render."
    );

    return false;
  }

  if (!Buffer.isBuffer(rawBody)) {
    return false;
  }

  if (!isValidHexSignature(receivedSignature)) {
    return false;
  }

  if (!isValidTimestamp(timestamp)) {
    return false;
  }

  const signedPayload = Buffer.concat([
    Buffer.from(`${timestamp}.`, "utf8"),
    rawBody,
  ]);

  const expectedSignature = createHmac(
    "sha256",
    hmacSecret
  )
    .update(signedPayload)
    .digest();

  const receivedSignatureBuffer = Buffer.from(
    receivedSignature,
    "hex"
  );

  if (
    receivedSignatureBuffer.length !==
    expectedSignature.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expectedSignature,
    receivedSignatureBuffer
  );
}

// ------------------------------------
// WEBHOOK PAIEMENT
// ------------------------------------

app.post(
  "/webhook/payment",

  express.raw({
    type: "application/json",
    limit: "100kb",
  }),

  async (req, res) => {
    try {
      const receivedSignature =
        req.get("x-zapay-signature");

      const timestamp =
        req.get("x-zapay-timestamp");

      // --------------------------------
      // CONFIGURATION HMAC
      // --------------------------------

      if (!hmacSecret) {
        console.error(
          "Webhook indisponible : ZAPAY_HMAC_SECRET absente."
        );

        return res.status(500).json({
          status: "error",
          message: "Configuration HMAC manquante",
        });
      }

      if (!receivedSignature || !timestamp) {
        return res.status(401).json({
          status: "error",
          message:
            "Signature ou timestamp manquant",
        });
      }

      // --------------------------------
      // VERIFICATION HMAC
      // --------------------------------

      const signatureIsValid =
        verifyWebhookSignature({
          rawBody: req.body,
          timestamp,
          receivedSignature,
        });

      if (!signatureIsValid) {
        console.warn(
          "Webhook refusé : signature invalide ou requête expirée."
        );

        return res.status(401).json({
          status: "error",
          message: "Signature invalide",
        });
      }

      // --------------------------------
      // LECTURE JSON
      // --------------------------------

      let paymentData;

      try {
        paymentData = JSON.parse(
          req.body.toString("utf8")
        );
      } catch (error) {
        return res.status(400).json({
          status: "error",
          message: "Corps JSON invalide",
        });
      }

      // --------------------------------
      // VERIFICATION ID
      // --------------------------------

      const paymentId = paymentData.id;

      if (!paymentId) {
        return res.status(400).json({
          status: "error",
          message: "ID paiement manquant",
        });
      }

      // --------------------------------
      // CONFIGURATION SUPABASE
      // --------------------------------

      if (!supabaseUrl || !supabaseKey) {
        console.error(
          "Configuration Supabase manquante dans webhook."
        );

        return res.status(500).json({
          status: "error",
          message:
            "Configuration Supabase manquante",
        });
      }

      const supabase = createClient(
        supabaseUrl,
        supabaseKey
      );

      // --------------------------------
      // MISE A JOUR AUTOMATIQUE
      // --------------------------------

      const { data, error } = await supabase
        .from("payments")
        .update({
          paid: true,
        })
        .eq("id", paymentId)
        .select("id, paid, amount, desc");

      if (error) {
        console.error(
          "Erreur mise à jour paiement :",
          error
        );

        return res.status(500).json({
          status: "error",
          message:
            "Erreur lors de la mise à jour du paiement",
        });
      }

      // Aucun paiement avec cet UUID
      if (!data || data.length === 0) {
        console.warn(
          "Paiement introuvable :",
          paymentId
        );

        return res.status(404).json({
          status: "error",
          message: "Paiement introuvable",
        });
      }

      const updatedPayment = data[0];

      console.log(
        "Paiement mis à jour automatiquement :",
        {
          id: updatedPayment.id,
          paid: updatedPayment.paid,
          amount: updatedPayment.amount,
        }
      );

      // --------------------------------
      // SUCCES
      // --------------------------------

      return res.status(200).json({
        status: "success",
        message:
          "Paiement authentifié et mis à jour",
        payment: {
          id: updatedPayment.id,
          paid: updatedPayment.paid,
          amount: updatedPayment.amount,
          desc: updatedPayment.desc,
        },
      });
    } catch (error) {
      console.error(
        "Erreur serveur webhook :",
        error
      );

      return res.status(500).json({
        status: "error",
        message: "Erreur interne du serveur",
      });
    }
  }
);

// ------------------------------------
// JSON POUR LES AUTRES ROUTES
// ------------------------------------

app.use(express.json());

// ------------------------------------
// ROUTES API
// ------------------------------------

app.get("/api/pay", payHandler);

app.get(
  "/api/check_payment",
  checkHandler
);

// ------------------------------------
// ROUTE DE SANTE
// ------------------------------------

app.get("/", (req, res) => {
  return res.status(200).json({
    status: "success",
    message: "Zapay backend online",
  });
});

// ------------------------------------
// DEMARRAGE
// ------------------------------------

app.listen(port, "0.0.0.0", () => {
  console.log(
    `Zapay backend running on port ${port}`
  );

  if (hmacSecret) {
    console.log(
      "Protection HMAC webhook activée."
    );
  } else {
    console.error(
      "ATTENTION : ZAPAY_HMAC_SECRET absente."
    );
  }

  if (supabaseUrl && supabaseKey) {
    console.log(
      "Connexion Supabase configurée."
    );
  } else {
    console.error(
      "ATTENTION : configuration Supabase absente."
    );
  }
});
