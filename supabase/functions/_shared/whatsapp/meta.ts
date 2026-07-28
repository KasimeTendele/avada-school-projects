import { assertEnv, getEnv } from "./env.ts";
import { createLogger } from "./logger.ts";
import { WhatsAppError } from "./response.ts";
import type { WhatsAppOutgoingMessage } from "./types.ts";

const log = createLogger("whatsapp:meta");

export class MetaClient {
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly graphVersion: string;

  constructor() {
    const env = getEnv();
    assertEnv(["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"], env);
    this.accessToken = env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    this.graphVersion = env.META_GRAPH_VERSION;
  }

  private endpoint(): string {
    return `https://graph.facebook.com/${this.graphVersion}/${this.phoneNumberId}/messages`;
  }

  async sendMessage(msg: WhatsAppOutgoingMessage): Promise<unknown> {
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      ...msg,
    };
    const res = await fetch(this.endpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      log.error("Meta API error", { status: res.status, data });
      throw new WhatsAppError(
        502,
        (data as { error?: { message?: string } })?.error?.message ??
          "Meta API returned an error",
        "META_API_ERROR",
        data,
      );
    }
    log.info("Message sent", {
      to: (msg as { to: string }).to,
      type: (msg as { type: string }).type,
    });
    return data;
  }
}

let cached: MetaClient | null = null;
export function getMetaClient(): MetaClient {
  if (!cached) cached = new MetaClient();
  return cached;
}

/** Verify Meta X-Hub-Signature-256 header. Returns true when valid or when
 *  META_APP_SECRET is not configured (dev mode). */
export async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const env = getEnv();
  if (!env.META_APP_SECRET) {
    log.warn("META_APP_SECRET not configured — skipping signature verification");
    return true;
  }
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.META_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computed.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}