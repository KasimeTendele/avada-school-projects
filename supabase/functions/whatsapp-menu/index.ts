import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HOME_MENU_ITEMS, MENU_IDS } from "../_shared/whatsapp/constants.ts";
import { createLogger } from "../_shared/whatsapp/logger.ts";
import { MESSAGES } from "../_shared/whatsapp/messages.ts";
import { fail, ok, preflight, WhatsAppError } from "../_shared/whatsapp/response.ts";
import { buildList, buildText, sendMessage } from "../whatsapp-send/index.ts";
import { upsertSession } from "../whatsapp-session/index.ts";

const log = createLogger("whatsapp-menu");

export async function showHomeMenu(phone: string, greetingName?: string) {
  await sendMessage(buildText(phone, MESSAGES.WELCOME(greetingName)));
  await sendMessage(
    buildList(phone, MESSAGES.MENU_TITLE, MESSAGES.MENU_BUTTON, [
      { title: "AvadaSchool", rows: HOME_MENU_ITEMS },
    ]),
  );
  await upsertSession(phone, { state: "in_menu", current_menu: MENU_IDS.HOME });
}

export async function handleMenuSelection(phone: string, menuId: string) {
  switch (menuId) {
    case MENU_IDS.FEES:
      // TODO: invokeBusinessFunction("fees-by-parent", { phone }) then format
      await sendMessage(buildText(phone, MESSAGES.FEES_COMING_SOON));
      await upsertSession(phone, { state: "idle", current_menu: MENU_IDS.FEES });
      return;
    case MENU_IDS.PAYMENT:
      // TODO: invokeBusinessFunction("payments", { ... }) to init AvadaPay
      await sendMessage(buildText(phone, MESSAGES.PAYMENT_COMING_SOON));
      await upsertSession(phone, { state: "awaiting_payment", current_menu: MENU_IDS.PAYMENT });
      return;
    case MENU_IDS.HISTORY:
      // TODO: invokeBusinessFunction("receipts", { phone })
      await sendMessage(buildText(phone, MESSAGES.HISTORY_COMING_SOON));
      await upsertSession(phone, { state: "idle", current_menu: MENU_IDS.HISTORY });
      return;
    case MENU_IDS.HELP:
      await sendMessage(buildText(phone, MESSAGES.HELP));
      await upsertSession(phone, { state: "idle", current_menu: MENU_IDS.HELP });
      return;
    default:
      log.warn("Unknown menu selection", { menuId });
      await sendMessage(buildText(phone, MESSAGES.UNKNOWN_COMMAND));
  }
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    if (req.method !== "POST") {
      throw new WhatsAppError(405, "Method not allowed", "BAD_REQUEST");
    }
    const { phone, menuId, name } = (await req.json()) as {
      phone?: string;
      menuId?: string;
      name?: string;
    };
    if (!phone) throw new WhatsAppError(400, "Missing `phone`", "BAD_REQUEST");
    if (menuId) await handleMenuSelection(phone, menuId);
    else await showHomeMenu(phone, name);
    return ok(null);
  } catch (err) {
    log.error("menu error", err);
    return fail(err);
  }
});