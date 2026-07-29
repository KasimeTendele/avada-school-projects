/**
 * WhatsApp Cloud API type definitions.
 * Kept intentionally close to the official Meta Graph API v23.0 payload shape.
 */

export type WhatsAppMessageType =
  | "text"
  | "image"
  | "document"
  | "template"
  | "interactive";

export interface WhatsAppTextMessage {
  to: string;
  type: "text";
  text: { body: string; preview_url?: boolean };
}

export interface WhatsAppImageMessage {
  to: string;
  type: "image";
  image: { link?: string; id?: string; caption?: string };
}

export interface WhatsAppDocumentMessage {
  to: string;
  type: "document";
  document: { link?: string; id?: string; filename?: string; caption?: string };
}

export interface WhatsAppTemplateMessage {
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components?: unknown[];
  };
}

export interface WhatsAppInteractiveButton {
  type: "reply";
  reply: { id: string; title: string };
}

export interface WhatsAppInteractiveListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppInteractiveMessage {
  to: string;
  type: "interactive";
  interactive:
    | {
        type: "button";
        body: { text: string };
        header?: { type: "text"; text: string };
        footer?: { text: string };
        action: { buttons: WhatsAppInteractiveButton[] };
      }
    | {
        type: "list";
        body: { text: string };
        header?: { type: "text"; text: string };
        footer?: { text: string };
        action: {
          button: string;
          sections: {
            title: string;
            rows: WhatsAppInteractiveListRow[];
          }[];
        };
      };
}

export type WhatsAppOutgoingMessage =
  | WhatsAppTextMessage
  | WhatsAppImageMessage
  | WhatsAppDocumentMessage
  | WhatsAppTemplateMessage
  | WhatsAppInteractiveMessage;

/* ---------- Incoming (webhook) ---------- */

export interface WhatsAppIncomingContact {
  wa_id: string;
  profile?: { name?: string };
}

export interface WhatsAppIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  button?: { text: string; payload: string };
  image?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; filename?: string };
}

export interface WhatsAppWebhookValue {
  messaging_product: "whatsapp";
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: WhatsAppIncomingContact[];
  messages?: WhatsAppIncomingMessage[];
  statuses?: unknown[];
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: {
    id: string;
    changes: { field: string; value: WhatsAppWebhookValue }[];
  }[];
}

/* ---------- Session ---------- */

export type SessionState =
  | "idle"
  | "awaiting_email"
  | "awaiting_password"
  | "in_menu"
  | "awaiting_input"
  | "awaiting_payment"
  | "closed"
  | string;

export interface WhatsAppAuthState {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  access_token: string;
  refresh_token: string;
  login_time: string;
}

export interface WhatsAppFlowState {
  name: "payment" | "password" | "fees";
  step: string;
  data: Record<string, unknown>;
}

export interface WhatsAppSessionPayload {
  auth?: WhatsAppAuthState;
  pending_email?: string;
  login_attempts?: number;
  flow?: WhatsAppFlowState;
  [key: string]: unknown;
}

export interface WhatsAppSession {
  id: string;
  phone_number: string;
  state: SessionState;
  current_menu: string | null;
  payload: Record<string, unknown>;
  last_activity: string;
  created_at: string;
  updated_at: string;
}