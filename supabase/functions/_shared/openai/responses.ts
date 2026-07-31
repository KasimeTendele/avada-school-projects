/**
 * Typed shapes for the OpenAI Chat Completions API (tool calling) plus small
 * helpers to normalise responses. Kept transport-agnostic and reusable by any
 * future module (vision, audio, embeddings…).
 */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  name?: string;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

export interface ChatToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ChatToolDefinition[];
  tool_choice?: "auto" | "none" | "required";
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    finish_reason: string | null;
    message: ChatMessage;
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class OpenAIError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "OPENAI_ERROR",
  ) {
    super(message);
    this.name = "OpenAIError";
  }
}

/** First assistant message of a completion (never undefined). */
export function firstMessage(res: ChatCompletionResponse): ChatMessage {
  return res.choices?.[0]?.message ?? { role: "assistant", content: null };
}

/** Plain text of a completion, trimmed. */
export function textOf(res: ChatCompletionResponse): string {
  return (firstMessage(res).content ?? "").trim();
}

/** Tool calls requested by the model, if any. */
export function toolCallsOf(res: ChatCompletionResponse): ChatToolCall[] {
  return firstMessage(res).tool_calls ?? [];
}

/** Safe JSON parse of tool-call arguments. */
export function parseToolArguments<T = Record<string, unknown>>(raw: string): T {
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}