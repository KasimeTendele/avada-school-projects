import type { ChatMessage } from "../_shared/openai/responses.ts";

/** Intentions reconnues par l'assistant. */
export type Intent =
  | "login"
  | "forgot_password"
  | "children"
  | "fees"
  | "history"
  | "payment"
  | "receipt"
  | "help"
  | "general"
  | "unknown";

/** Contexte d'exécution passé aux outils — jamais de mot de passe ici. */
export interface AssistantContext {
  phone: string;
  authenticated: boolean;
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  accessToken?: string;
  currentMenu?: string | null;
  state?: string;
  locale: string;
}

export interface AssistantRequest {
  phone: string;
  message: string;
  /** Quand true, l'appelant gère l'envoi WhatsApp lui-même. */
  dryRun?: boolean;
}

export interface AssistantAction {
  /** Menu WhatsApp à ouvrir après la réponse (ex. "fees"). */
  openMenu?: string;
  /** Outils réellement exécutés — utile pour l'observabilité. */
  toolsUsed: string[];
}

export interface AssistantResult {
  intent: Intent;
  reply: string;
  action: AssistantAction;
  memoryTurns: number;
}

export type Conversation = ChatMessage[];

/** Résultat normalisé d'un outil, sérialisé vers le modèle. */
export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  /** Instruction facultative pour l'orchestrateur (ouvrir un menu WhatsApp). */
  openMenu?: string;
}

export interface ToolHandler {
  name: string;
  description: string
  parameters: Record<string, unknown>;
  /** Requiert une session parent authentifiée. */
  requiresAuth: boolean;
  run(args: Record<string, unknown>, ctx: AssistantContext): Promise<ToolResult>;
}