/**
 * Minimal, dependency-free OpenAI client for Deno / Supabase Edge Functions.
 * Only transport + retry live here; prompts, tools and business logic do NOT.
 */
import { assertOpenAIConfig, getOpenAIConfig, type OpenAIConfig } from "./config.ts";
import {
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  OpenAIError,
} from "./responses.ts";

export interface OpenAIClient {
  config: OpenAIConfig;
  chat(req: Omit<ChatCompletionRequest, "model"> & { model?: string }): Promise<ChatCompletionResponse>;
  /** Raw POST for future modalities (audio, images, embeddings…). */
  post<T>(path: string, body: unknown): Promise<T>;
}

export function createOpenAIClient(config = getOpenAIConfig()): OpenAIClient {
  assertOpenAIConfig(config);

  async function request<T>(path: string, body: unknown, attempt = 0): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const res = await fetch(`${config.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        // Retry once on rate limit / transient upstream errors.
        const retryable = res.status === 429 || res.status >= 500;
        if (retryable && attempt < 1) {
          await new Promise((r) => setTimeout(r, 800));
          return request<T>(path, body, attempt + 1);
        }
        let message = text || `HTTP ${res.status}`;
        try {
          message = (JSON.parse(text)?.error?.message as string) ?? message;
        } catch { /* keep raw text */ }
        throw new OpenAIError(res.status, message);
      }
      return JSON.parse(text) as T;
    } catch (err) {
      if (err instanceof OpenAIError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new OpenAIError(504, "OpenAI request timed out", "TIMEOUT");
      }
      throw new OpenAIError(0, (err as Error).message, "NETWORK");
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    config,
    post: <T>(path: string, body: unknown) => request<T>(path, body),
    chat: (req) =>
      request<ChatCompletionResponse>("/chat/completions", {
        model: req.model ?? config.model,
        temperature: req.temperature ?? config.temperature,
        max_tokens: req.max_tokens ?? config.maxOutputTokens,
        ...req,
      }),
  };
}