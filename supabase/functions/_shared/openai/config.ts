/**
 * Configuration centralisée du fournisseur LLM (compatible API OpenAI).
 * Par défaut : Google Gemini via son endpoint compatible OpenAI.
 * Aucune clé en dur — tout vient des secrets. Lecture paresseuse.
 */
export interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  fallbackModel: string;
  temperature: number;
  maxOutputTokens: number;
  /** Max tool-call round trips per user message (guards against loops). */
  maxToolRounds: number;
  /** Conversation memory retention, aligned with the WhatsApp session TTL. */
  memoryTtlMinutes: number;
  /** Max stored conversation turns kept in the session payload. */
  memoryMaxMessages: number;
  requestTimeoutMs: number;
}

function env(name: string, fallback = ""): string {
  return Deno.env.get(name) ?? fallback;
}

export function getOpenAIConfig(): OpenAIConfig {
  return {
    // Gemini d'abord (endpoint compatible OpenAI), repli sur l'ancienne clé OpenAI.
    apiKey: env("GEMINI_API_KEY") || env("OPENAI_API_KEY"),
    baseUrl: env("OPENAI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"),
    model: env("OPENAI_MODEL", "gemini-2.5-flash"),
    fallbackModel: env("OPENAI_FALLBACK_MODEL", "gemini-2.5-flash-lite"),
    temperature: Number(env("OPENAI_TEMPERATURE", "0.2")),
    maxOutputTokens: Number(env("OPENAI_MAX_TOKENS", "700")),
    maxToolRounds: Number(env("OPENAI_MAX_TOOL_ROUNDS", "4")),
    memoryTtlMinutes: Number(env("AI_MEMORY_TTL_MINUTES", "30")),
    memoryMaxMessages: Number(env("AI_MEMORY_MAX_MESSAGES", "20")),
    requestTimeoutMs: Number(env("OPENAI_TIMEOUT_MS", "25000")),
  };
}

export function assertOpenAIConfig(cfg = getOpenAIConfig()): OpenAIConfig {
  if (!cfg.apiKey) throw new Error("Missing secret: GEMINI_API_KEY");
  return cfg;
}