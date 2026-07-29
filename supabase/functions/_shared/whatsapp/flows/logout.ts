import { createLogger } from "../logger.ts";
import { MESSAGES } from "../messages.ts";
import { buildText, sendMessage } from "../send.ts";
import { updatePayload } from "../session.ts";

const log = createLogger("whatsapp:logout");

export async function logoutUser(phone: string): Promise<void> {
  await updatePayload(
    phone,
    { auth: undefined, pending_email: undefined, login_attempts: 0, flow: undefined },
    { state: "closed", current_menu: null },
  );
  log.info("Logged out", { phone });
  await sendMessage(buildText(phone, MESSAGES.LOGOUT_DONE));
}