/**
 * Edge Function `ai-assistant`.
 * POST { phone, message, dryRun? } → réponse IA, envoyée via whatsapp-send.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createOpenAIClient } from "../_shared/openai/client.ts";
import { createLogger } from "../_shared/whatsapp/logger.ts";
import { fail, ok, preflight, WhatsAppError } from "../_shared/whatsapp/response.ts";
import { buildText, sendMessage } from "../_shared/whatsapp/send.ts";
import { buildContext } from "./context.ts";
import { detectIntent } from "./intent.ts";
import { describeError, runAssistant } from "./openai.ts";
import type { AssistantRequest } from "./types.ts";

const log = createLogger("ai-assistant");

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  let phone = "";
  try {
    if (req.method !== "POST") throw new WhatsAppError(405, "Method not allowed", "BAD_REQUEST");
    const body = (await req.json()) as AssistantRequest;
    phone = (body.phone ?? "").trim();
    const message = (body.message ?? "").trim();
    if (!phone) throw new WhatsAppError(400, "Missing `phone`", "BAD_REQUEST");
    if (!message) throw new WhatsAppError(400, "Missing `message`", "BAD_REQUEST");

    const client = createOpenAIClient();
    const ctx = await buildContext(phone);
    const intent = await detectIntent(message, client);
    const result = await runAssistant(message, ctx, intent, client);

    if (!body.dryRun) await sendMessage(buildText(phone, result.reply));
    log.info("assistant replied", { phone, intent, tools: result.action.toolsUsed });
    return ok(result);
  } catch (err) {
    log.error("assistant error", err);
    if (phone) {
      try { await sendMessage(buildText(phone, describeError(err))); } catch { /* ignore */ }
    }
    return fail(err);
  }
});