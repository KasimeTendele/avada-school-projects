import { HOME_MENU_ITEMS, MENU_IDS } from "./constants.ts";
import { createLogger } from "./logger.ts";
import { MESSAGES } from "./messages.ts";
import { buildList, buildText, sendMessage } from "./send.ts";
import { getPayload, getSession, updatePayload } from "./session.ts";
import { startFeesFlow } from "./flows/fees.ts";
import { startHistoryFlow } from "./flows/history.ts";
import { startPaymentFlow } from "./flows/payment.ts";
import { startPasswordFlow } from "./flows/password.ts";
import { logoutUser } from "./flows/logout.ts";

const log = createLogger("whatsapp:menu");

/** Send the authenticated home menu. Called AFTER a successful login. */
export async function showHomeMenu(phone: string, firstName?: string) {
  const session = await getSession(phone);
  const auth = getPayload(session).auth;
  const name = firstName ?? auth?.first_name ?? "";
  await sendMessage(buildText(phone, MESSAGES.AUTH_SUCCESS(name || "Parent")));
  await sendMessage(
    buildList(phone, MESSAGES.MENU_TITLE, MESSAGES.MENU_BUTTON, [
      { title: "AvadaSchool", rows: HOME_MENU_ITEMS },
    ]),
  );
  await updatePayload(phone, { flow: undefined }, { state: "in_menu", current_menu: MENU_IDS.HOME });
}

/** Dispatch a menu selection to the matching flow. */
export async function handleMenuSelection(phone: string, menuId: string) {
  switch (menuId) {
    case MENU_IDS.FEES:     return startFeesFlow(phone);
    case MENU_IDS.PAYMENT:  return startPaymentFlow(phone);
    case MENU_IDS.HISTORY:  return startHistoryFlow(phone);
    case MENU_IDS.PASSWORD: return startPasswordFlow(phone);
    case MENU_IDS.HELP:
      await sendMessage(buildText(phone, MESSAGES.HELP));
      await updatePayload(phone, { flow: undefined }, { state: "in_menu", current_menu: MENU_IDS.HELP });
      return;
    case MENU_IDS.LOGOUT:   return logoutUser(phone);
    default:
      log.warn("Unknown menu selection", { menuId });
      await sendMessage(buildText(phone, MESSAGES.UNKNOWN_COMMAND));
  }
}