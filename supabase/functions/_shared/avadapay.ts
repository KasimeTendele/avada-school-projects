const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

export const AVADAPAY_API_KEY = Deno.env.get("AVADAPAY_API_KEY") ?? "";
export const AVADAPAY_MERCHANT_ID = Deno.env.get("AVADAPAY_MERCHANT_ID") ?? "";
export const AVADAPAY_SECRET_KEY = Deno.env.get("AVADAPAY_SECRET_KEY") ?? "";

export const AVADAPAY_BASE = "https://api.avadapay.tech";

export const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/payments-callback`;

// Provider id mapping per mobile money operator
export const PROVIDERS = {
  AIRTEL: { id: 17, prefixes: ["97", "98", "99"] },
  VODACOM: { id: 9, prefixes: ["81", "82", "83", "86"] },
  ORANGE: { id: 10, prefixes: ["84", "85", "89"] },
  AFRICELL: { id: 19, prefixes: ["90", "91"] },
} as const;

export type ProviderName = keyof typeof PROVIDERS;

// Normalize a phone: strip non-digits, drop leading 0 and 243 country code
export function normalizePhone(raw: string): string {
  let p = (raw ?? "").replace(/\D/g, "");
  if (p.startsWith("243")) p = p.slice(3);
  if (p.startsWith("0")) p = p.slice(1);
  return p;
}

export function detectProvider(phone: string): ProviderName | null {
  const p = normalizePhone(phone);
  const prefix = p.slice(0, 2);
  for (const [name, cfg] of Object.entries(PROVIDERS)) {
    if ((cfg.prefixes as readonly string[]).includes(prefix)) return name as ProviderName;
  }
  return null;
}

// Build the canonical string-to-sign in insertion order (matches AvadaPay's JS snippet)
function buildSignString(data: Record<string, unknown>, prefix = ""): string {
  let s = "";
  for (const key of Object.keys(data)) {
    if (key === "signature") continue;
    const v = (data as Record<string, unknown>)[key];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      s += buildSignString(v as Record<string, unknown>, prefix + key + ".");
    } else {
      s += prefix + key + String(v);
    }
  }
  return s;
}

async function hmacSha512Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signPayload(data: Record<string, unknown>): Promise<string> {
  const s = buildSignString(data);
  return await hmacSha512Hex(s, AVADAPAY_SECRET_KEY);
}

export interface InitC2BParams {
  orderId: string;
  amount: number;
  currency: string;
  phone: string; // normalized (no leading 0)
  providerId: number;
  customerName: string;
  customerEmail?: string;
  customerUserId: string;
  customerIp?: string;
}

export async function initiateC2B(p: InitC2BParams): Promise<{
  ok: boolean;
  status: number;
  data: unknown;
  signature: string;
  body: Record<string, unknown>;
}> {
  const body: Record<string, unknown> = {
    merchant_id: AVADAPAY_MERCHANT_ID,
    customer_id: p.phone,
    customer_user_id: p.customerUserId,
    order_id: p.orderId,
    amount: p.amount.toFixed(2),
    currency: p.currency,
    country: "CD",
    callback_url: CALLBACK_URL,
    provider_id: String(p.providerId),
    extra: {
      customer_name: p.customerName,
      customer_ip: p.customerIp ?? "0.0.0.0",
      customer_email: p.customerEmail ?? "noreply@avadaschool.app",
      customer_phone: p.phone,
      customer_doc_type: "ID",
      customer_doc_number: "N/A",
    },
  };
  const signature = await signPayload(body);
  const payload = { ...body, signature };

  const res = await fetch(`${AVADAPAY_BASE}/${AVADAPAY_API_KEY}/payment_c2b`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data, signature, body };
}