/**
 * Centralised OpenAI configuration. Never hard-code keys — everything comes
 * from Supabase secrets. Values are read lazily so a cold start never throws.
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
    apiKey: env("OPENAI_API_KEY"),
    baseUrl: env("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    model: env("OPENAI_MODEL", "gpt-4.1-mini"),
    fallbackModel: env("OPENAI_FALLBACK_MODEL", "gpt-4o-mini"),
    temperature: Number(env("OPENAI_TEMPERATURE", "0.2")),
    maxOutputTokens: Number(env("OPENAI_MAX_TOKENS", "700")),
    maxToolRounds: Number(env("OPENAI_MAX_TOOL_ROUNDS", "4")),
    memoryTtlMinutes: Number(env("AI_MEMORY_TTL_MINUTES", "30")),
    memoryMaxMessages: Number(env("AI_MEMORY_MAX_MESSAGES", "20")),
    requestTimeoutMs: Number(env("OPENAI_TIMEOUT_MS", "25000")),
  };
}

export function assertOpenAIConfig(cfg = getOpenAIConfig()): OpenAIConfig {
  if (!cfg.apiKey) throw new Error("Missing secret: OPENAI_API_KEY");
  return cfg;
}