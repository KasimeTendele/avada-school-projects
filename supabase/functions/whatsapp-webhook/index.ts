import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createLogger } from "../_shared/whatsapp/logger.ts";
import { verifyMetaSignature } from "../_shared/whatsapp/meta.ts";
import { routeWebhookPayload } from "../_shared/whatsapp/router.ts";

const log = createLogger("whatsapp-webhook");

/**
 * Edge Function : whatsapp-webhook
 * Point d'entrée officiel de la WhatsApp Cloud API de Meta pour AvadaSchool.
 *
 * Responsabilités actuelles :
 *  - Vérification du webhook (GET) : répondre au challenge de Meta.
 *  - Réception des événements (POST) : acquitter immédiatement et logger le payload.
 *
 * Évolutions prévues (TODO futurs) :
 *  - Lecture et parsing des messages entrants (texte, boutons, interactions).
 *  - Gestion des conversations / sessions utilisateur.
 *  - Appel des Edge Functions métier existantes (auth, parents, paiements, etc.).
 *  - Envoi des réponses via WhatsApp Cloud API (messages sortants).
 */

// Headers CORS communs pour les réponses de webhook.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * Réponse JSON standardisée avec les headers CORS.
 */
function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(extraHeaders ?? {}),
    },
  });
}

/**
 * Vérification du webhook Meta (GET).
 *
 * Meta envoie :
 *   ?hub.mode=subscribe
 *   &hub.verify_token=<TOKEN>
 *   &hub.challenge=<CHALLENGE>
 *
 * On répond avec le hub.challenge si le verify_token correspond à
 * WHATSAPP_VERIFY_TOKEN, sinon 403.
 */
async function handleVerification(url: URL): Promise<Response> {
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  console.log("[GET] Webhook verification request", {
    mode,
    verifyToken: verifyToken ? "present" : "missing",
    challenge: challenge ? "present" : "missing",
  });

  const expectedToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

  if (!expectedToken) {
    console.error("[GET] WHATSAPP_VERIFY_TOKEN is not configured");
    return jsonResponse(
      { success: false, message: "Webhook verification token not configured" },
      500
    );
  }

  if (mode === "subscribe" && verifyToken === expectedToken) {
    console.log("[GET] Webhook verification successful");

    // Meta attend le challenge en texte brut, pas du JSON.
    return new Response(challenge, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  console.warn("[GET] Webhook verification failed", {
    modeMatches: mode === "subscribe",
    tokenMatches: verifyToken === expectedToken,
  });

  return jsonResponse(
    { success: false, message: "Forbidden: verification token mismatch" },
    403
  );
}

/**
 * Réception des événements WhatsApp (POST).
 *
 * On répond immédiatement 200 pour éviter les retries de Meta,
 * puis on traite/traitera le payload de manière asynchrone.
 */
async function handleWebhookEvent(request: Request): Promise<Response> {
  try {
    const rawBody = await request.text();

    // Verify Meta signature (HMAC-SHA256 with META_APP_SECRET).
    const signature =
      request.headers.get("x-hub-signature-256") ??
      request.headers.get("x-hub-signature");
    const signatureOk = await verifyMetaSignature(rawBody, signature);
    if (!signatureOk) {
      log.warn("Invalid Meta signature — rejecting payload");
      return new Response("Forbidden", {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    let payload: Record<string, unknown> | null = null;
    try {
      payload = rawBody ? JSON.parse(rawBody) : null;
    } catch (parseError) {
      console.warn("[POST] Body is not valid JSON; logging raw body", {
        error: parseError instanceof Error ? parseError.message : "parse error",
      });
    }

    console.log("[POST] WhatsApp event received", {
      headers: Object.fromEntries(request.headers.entries()),
      body: payload ?? rawBody,
    });

    // Dispatch to the router (fire-and-forget: ACK Meta immediately).
    if (payload && typeof payload === "object") {
      queueMicrotask(() => {
        routeWebhookPayload(payload as never).catch((err) => {
          log.error("Router failed", { err: (err as Error).message });
        });
      });
    }

    return new Response("EVENT_RECEIVED", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("[POST] Unexpected error while handling webhook", {
      error: error instanceof Error ? error.message : "unknown error",
      stack: error instanceof Error ? error.stack : null,
    });

    return jsonResponse(
      { success: false, message: "EVENT_RECEIVED" },
      200
    );
  }
}

/**
 * Handler principal.
 */
serve(async (request: Request) => {
  try {
    const url = new URL(request.url);

    // Préflight CORS : Meta / navigateurs peuvent envoyer OPTIONS.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      return await handleVerification(url);
    }

    if (request.method === "POST") {
      return await handleWebhookEvent(request);
    }

    console.warn("[MAIN] Method not allowed", { method: request.method });
    return jsonResponse(
      { success: false, message: "Method not allowed" },
      405
    );
  } catch (error) {
    console.error("[MAIN] Unhandled exception", {
      error: error instanceof Error ? error.message : "unknown error",
      stack: error instanceof Error ? error.stack : null,
    });

    return jsonResponse(
      { success: false, message: "Internal server error" },
      500
    );
  }
});
