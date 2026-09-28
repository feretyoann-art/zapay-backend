const express = require("express");
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

// Tolérance maximale pour éviter qu'une ancienne
// requête signée puisse être rejouée indéfiniment.
const WEBHOOK_MAX_AGE_SECONDS = 300;

// ------------------------------------
// HANDLERS API
// ------------------------------------
const payHandler = require("./api/pay.js");
const checkHandler = require("./api/check_payment.js");

// ------------------------------------
// FONCTIONS HMAC
// ------------------------------------

/**
 * Vérifie que la signature reçue est constituée
 * exactement de 64 caractères hexadécimaux.
 */
function isValidHexSignature(signature) {
  return (
    typeof signature === "string" &&
    /^[0-9a-f]{64}$/i.test(signature)
  );
}

/**
 * Vérifie que le timestamp est valide
 * et suffisamment récent.
 */
function isValidTimestamp(timestamp) {
  if (typeof timestamp !== "string") {
    return false;
  }

  const timestampNumber = Number(timestamp);

  if (!Number.isFinite(timestampNumber)) {
    return false;
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const requestAge = Math.abs(
    currentTimestamp - timestampNumber
  );

  return requestAge <= WEBHOOK_MAX_AGE_SECONDS;
}

/**
 * Recalcule puis vérifie la signature HMAC-SHA256.
 *
 * Données signées :
 * timestamp + "." + corps JSON brut
 */
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
// WEBHOOK HMAC SÉCURISÉ
// ------------------------------------
//
// IMPORTANT : cette route doit être placée
// avant app.use(express.json()).
//
// express.raw() conserve les octets exacts reçus.
// La signature est calculée sur ce corps brut.
//
app.post(
  "/webhook/payment",
  express.raw({
    type: "application/json",
    limit: "100kb",
  }),
  (req, res) => {
    try {
      const receivedSignature =
        req.get("x-zapay-signature");

      const timestamp =
        req.get("x-zapay-timestamp");

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

      console.log(
        "Webhook paiement vérifié :",
        {
          id: paymentData.id ?? null,
          status: paymentData.status ?? null,
          amount: paymentData.amount ?? null,
        }
      );

      return res.status(200).json({
        status: "success",
        message: "Webhook authentifié",
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
// PARSEUR JSON POUR LES AUTRES ROUTES
// ------------------------------------
app.use(express.json());

// ------------------------------------
// ROUTES API EXISTANTES
// ------------------------------------
app.get("/api/pay", payHandler);
app.get("/api/check_payment", checkHandler);

// ------------------------------------
// ROUTE DE SANTÉ
// ------------------------------------
app.get("/", (req, res) => {
  return res.status(200).json({
    status: "success",
    message: "Zapay backend online",
  });
});

// ------------------------------------
// DÉMARRAGE DU SERVEUR
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
});
