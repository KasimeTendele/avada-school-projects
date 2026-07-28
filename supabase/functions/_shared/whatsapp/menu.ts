import { HOME_MENU_ITEMS, MENU_IDS } from "./constants.ts";
import { createLogger } from "./logger.ts";
import { MESSAGES } from "./messages.ts";
import { buildList, buildText, sendMessage } from "./send.ts";
import { upsertSession } from "./session.ts";

const log = createLogger("whatsapp:menu");

export async function showHomeMenu(phone: string, greetingName?: string) {
  await sendMessage(buildText(phone, MESSAGES.WELCOME(greetingName)));
  await sendMessage(buildList(phone, MESSAGES.MENU_TITLE, MESSAGES.MENU_BUTTON, [
    { title: "AvadaSchool", rows: HOME_MENU_ITEMS },
  ]));
  await upsertSession(phone, { state: "in_menu", current_menu: MENU_IDS.HOME });
}

export async function handleMenuSelection(phone: string, menuId: string) {
  switch (menuId) {
    case MENU_IDS.FEES:
      await sendMessage(buildText(phone, MESSAGES.FEES_COMING_SOON));
      await upsertSession(phone, { state: "idle", current_menu: MENU_IDS.FEES });
      return;
    case MENU_IDS.PAYMENT:
      await sendMessage(buildText(phone, MESSAGES.PAYMENT_COMING_SOON));
      await upsertSession(phone, { state: "awaiting_payment", current_menu: MENU_IDS.PAYMENT });
      return;
    case MENU_IDS.HISTORY:
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