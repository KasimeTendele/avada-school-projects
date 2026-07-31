/**
 * Mémoire de conversation (30 min) stockée dans `whatsapp_sessions.payload.ai`.
 * Réutilise entièrement le module de session existant — aucune nouvelle table.
 */
import { getOpenAIConfig } from "../_shared/openai/config.ts";
import type { ChatMessage } from "../_shared/openai/responses.ts";
import { getPayload, getSession, updatePayload } from "../_shared/whatsapp/session.ts";
import type { Conversation } from "./types.ts";

interface AiMemory {
  updated_at: string;
  messages: Conversation;
}

function isFresh(memory: AiMemory | undefined, ttlMinutes: number): boolean {
  if (!memory?.updated_at) return false;
  return Date.now() - new Date(memory.updated_at).getTime() < ttlMinutes * 60_000;
}

/** Historique utile (user/assistant uniquement) encore dans la fenêtre TTL. */
export async function loadMemory(phone: string): Promise<Conversation> {
  const cfg = getOpenAIConfig();
  const memory = getPayload(await getSession(phone)).ai as AiMemory | undefined;
  if (!isFresh(memory, cfg.memoryTtlMinutes)) return [];
  return (memory?.messages ?? []).slice(-cfg.memoryMaxMessages);
}

/** Ajoute un échange à la mémoire, tronqué à `memoryMaxMessages`. */
export async function appendMemory(
  phone: string,
  turns: ChatMessage[],
): Promise<number> {
  const cfg = getOpenAIConfig();
  const previous = await loadMemory(phone);
  // On ne persiste jamais les appels d'outils bruts : seulement le dialogue.
  const clean = turns
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({ role: m.role, content: m.content }) as ChatMessage);
  const messages = [...previous, ...clean].slice(-cfg.memoryMaxMessages);
  await updatePayload(phone, {
    ai: { updated_at: new Date().toISOString(), messages } satisfies AiMemory,
  });
  return messages.length;
}

export async function clearMemory(phone: string): Promise<void> {
  await updatePayload(phone, { ai: undefined });
}