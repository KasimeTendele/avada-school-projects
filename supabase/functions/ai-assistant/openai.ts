/**
 * Orchestrateur : prompt + contexte + mémoire + boucle d'appels d'outils.
 * Ne contient aucune logique métier — les outils délèguent aux Edge Functions.
 */
import { createOpenAIClient, type OpenAIClient } from "../_shared/openai/client.ts";
import {
  type ChatMessage,
  OpenAIError,
  parseToolArguments,
  textOf,
  toolCallsOf,
} from "../_shared/openai/responses.ts";
import { createLogger } from "../_shared/whatsapp/logger.ts";
import { FALLBACK_REPLY, formatForWhatsApp, formatToolResult } from "./formatter.ts";
import { appendMemory, loadMemory } from "./memory.ts";
import { buildContextPrompt, buildIntentHint, SYSTEM_PROMPT } from "./prompts.ts";
import { runTool, toolDefinitions } from "./tools.ts";
import type { AssistantContext, AssistantResult, Intent } from "./types.ts";

const log = createLogger("ai-assistant:openai");

export async function runAssistant(
  message: string,
  ctx: AssistantContext,
  intent: Intent,
  client: OpenAIClient = createOpenAIClient(),
): Promise<AssistantResult> {
  const history = await loadMemory(ctx.phone);
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: buildContextPrompt(ctx) },
    { role: "system", content: buildIntentHint(intent) },
    ...history,
    { role: "user", content: message },
  ];

  const tools = toolDefinitions(ctx);
  const toolsUsed: string[] = [];
  let openMenu: string | undefined;
  let reply = "";

  for (let round = 0; round <= client.config.maxToolRounds; round++) {
    const res = await client.chat({
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? "auto" : undefined,
    });
    const calls = toolCallsOf(res);
    if (calls.length === 0) {
      reply = textOf(res);
      break;
    }
    messages.push({ role: "assistant", content: null, tool_calls: calls });
    for (const call of calls) {
      const args = parseToolArguments(call.function.arguments);
      const result = await runTool(call.function.name, args, ctx);
      toolsUsed.push(call.function.name);
      if (result.openMenu) openMenu = result.openMenu;
      log.info("tool executed", { name: call.function.name, ok: result.ok });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: formatToolResult(result),
      });
    }
  }

  const finalReply = formatForWhatsApp(reply || FALLBACK_REPLY);
  const memoryTurns = await appendMemory(ctx.phone, [
    { role: "user", content: message },
    { role: "assistant", content: finalReply },
  ]);

  return { intent, reply: finalReply, action: { openMenu, toolsUsed }, memoryTurns };
}

export function describeError(err: unknown): string {
  if (err instanceof OpenAIError) {
    if (err.status === 429) {
      return "L'assistant est momentanément surchargé. Réessayez dans quelques instants ou tapez *menu*.";
    }
    if (err.code === "TIMEOUT") {
      return "L'assistant met trop de temps à répondre. Réessayez ou tapez *menu*.";
    }
  }
  return FALLBACK_REPLY;
}