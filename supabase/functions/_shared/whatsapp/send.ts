import { getMetaClient } from "./meta.ts";
import type {
  WhatsAppInteractiveButton,
  WhatsAppInteractiveListRow,
  WhatsAppOutgoingMessage,
} from "./types.ts";

export function buildText(to: string, body: string): WhatsAppOutgoingMessage {
  return { to, type: "text", text: { body } };
}
export function buildImage(to: string, image: { link?: string; id?: string; caption?: string }): WhatsAppOutgoingMessage {
  return { to, type: "image", image };
}
export function buildDocument(to: string, document: { link?: string; id?: string; filename?: string; caption?: string }): WhatsAppOutgoingMessage {
  return { to, type: "document", document };
}
export function buildTemplate(to: string, name: string, languageCode = "fr", components?: unknown[]): WhatsAppOutgoingMessage {
  return { to, type: "template", template: { name, language: { code: languageCode }, components } };
}
export function buildButtons(to: string, body: string, buttons: WhatsAppInteractiveButton[], opts?: { header?: string; footer?: string }): WhatsAppOutgoingMessage {
  return {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      ...(opts?.header ? { header: { type: "text", text: opts.header } } : {}),
      ...(opts?.footer ? { footer: { text: opts.footer } } : {}),
      action: { buttons },
    },
  };
}
export function buildList(to: string, body: string, button: string, sections: { title: string; rows: WhatsAppInteractiveListRow[] }[], opts?: { header?: string; footer?: string }): WhatsAppOutgoingMessage {
  return {
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      ...(opts?.header ? { header: { type: "text", text: opts.header } } : {}),
      ...(opts?.footer ? { footer: { text: opts.footer } } : {}),
      action: { button, sections },
    },
  };
}
export async function sendMessage(msg: WhatsAppOutgoingMessage): Promise<unknown> {
  return getMetaClient().sendMessage(msg);
}