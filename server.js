const express = require("express");

const {
  createHash,
  createHmac,
  timingSafeEqual,
} = require("node:crypto");

const app = express();

// ------------------------------------
// CONFIGURATION
// ------------------------------------
const port = process.env.PORT || 3000;
const hmacSecret = process.env.ZAPAY_HMAC_SECRET;

// Tolérance maximale contre les rejeux.
const WEBHOOK_MAX_AGE_SECONDS = 300;

// Diagnostic temporaire.
// À remettre sur false après validation HMAC.
const HMAC_DIAGNOSTIC_ENABLED = false;

// ------------------------------------
// HANDLERS API
// ------------------------------------
const payHandler = require("./api/pay.js");
const checkHandler = require("./api/check_payment.js");

// ------------------------------------
// OUTILS DE DIAGNOSTIC
// ------------------------------------

function shortSha256(value) {
  return createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 12);
}

function shortBufferSha256(buffer) {
  return createHash("sha256")
    .update(buffer)
    .digest("hex")
    .slice(0, 12);
}

// ------------------------------------
// FONCTIONS HMAC
// ------------------------------------

function isValidHexSignature(signature) {
  return (
    typeof signature === "string" &&
    /^[0-9a-f]{64}$/i.test(signature)
  );
}

function getTimestampDiagnostic(timestamp) {
  if (typeof timestamp !== "string") {
    return {
      valid: false,
      reason: "timestamp_not_string",
      ageSeconds: null,
    };
  }

  const timestampNumber = Number(timestamp);

  if (!Number.isFinite(timestampNumber)) {
    return {
      valid: false,
      reason: "timestamp_not_number",
      ageSeconds: null,
    };
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);

  const requestAge = Math.abs(
    currentTimestamp - timestampNumber
  );

  return {
    valid: requestAge <= WEBHOOK_MAX_AGE_SECONDS,
    reason:
      requestAge <= WEBHOOK_MAX_AGE_SECONDS
        ? "timestamp_valid"
        : "timestamp_expired",
    ageSeconds: requestAge,
  };
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
    console.error(
      "Le corps reçu par le webhook n'est pas un Buffer."
    );

    return false;
  }

  const signatureFormatIsValid =
    isValidHexSignature(receivedSignature);

  const timestampDiagnostic =
    getTimestampDiagnostic(timestamp);

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

  if (HMAC_DIAGNOSTIC_ENABLED) {
    console.log("HMAC_DIAGNOSTIC", {
      secretLength: hmacSecret.length,

      // Empreinte courte, jamais le secret.
      secretFingerprint: shortSha256(hmacSecret),

      timestamp,
      timestampValid: timestampDiagnostic.valid,
      timestampReason: timestampDiagnostic.reason,
      timestampAgeSeconds:
        timestampDiagnostic.ageSeconds,

      rawBodyLength: rawBody.length,
      rawBodyUtf8: rawBody.toString("utf8"),
      rawBodyFingerprint:
        shortBufferSha256(rawBody),

      signedPayloadLength: signedPayload.length,
      signedPayloadFingerprint:
        shortBufferSha256(signedPayload),

      receivedSignatureFormatValid:
        signatureFormatIsValid,

      receivedSignaturePrefix:
        typeof receivedSignature === "string"
          ? receivedSignature.slice(0, 12)
          : null,

      expectedSignaturePrefix:
        expectedSignature
          .toString("hex")
          .slice(0, 12),
    });
  }

  if (!signatureFormatIsValid) {
    return false;
  }

  if (!timestampDiagnostic.valid) {
    return false;
  }

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
          message: "Signature ou timestamp manquant",
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
// PARSEUR JSON DES AUTRES ROUTES
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

    if (HMAC_DIAGNOSTIC_ENABLED) {
      console.log(
        "Diagnostic HMAC temporaire activé.",
        {
          secretLength: hmacSecret.length,
          secretFingerprint:
            shortSha256(hmacSecret),
        }
      );
    }
  } else {
    console.error(
      "ATTENTION : ZAPAY_HMAC_SECRET absente."
    );
  }
});
