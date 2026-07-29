import { callBusinessFunction } from "../api.ts";
import { MENU_IDS } from "../constants.ts";
import { createLogger } from "../logger.ts";
import { MESSAGES } from "../messages.ts";
import { buildText, sendMessage } from "../send.ts";
import { getPayload, getSession, updatePayload } from "../session.ts";
import { showHomeMenu } from "../menu.ts";

const log = createLogger("whatsapp:password");

type Step = "current" | "new" | "confirm";
interface Data { current?: string; new?: string }

export async function startPasswordFlow(phone: string): Promise<void> {
  await updatePayload(
    phone,
    { flow: { name: "password", step: "current", data: {} } },
    { state: "awaiting_input", current_menu: MENU_IDS.PASSWORD },
  );
  await sendMessage(buildText(phone, MESSAGES.PWD_ASK_CURRENT));
}

export async function handlePasswordFlow(phone: string, text: string): Promise<void> {
  const session = await getSession(phone);
  const payload = getPayload(session);
  const flow = payload.flow;
  const auth = payload.auth;
  if (!flow || flow.name !== "password" || !auth) return;
  const step = flow.step as Step;
  const data = (flow.data ?? {}) as Data;

  if (step === "current") {
    await updatePayload(phone, {
      flow: { name: "password", step: "new", data: { current: text } },
    });
    await sendMessage(buildText(phone, MESSAGES.PWD_ASK_NEW));
    return;
  }
  if (step === "new") {
    if (text.length < 8) {
      await sendMessage(buildText(phone, MESSAGES.PWD_TOO_SHORT));
      return;
    }
    await updatePayload(phone, {
      flow: { name: "password", step: "confirm", data: { ...data, new: text } },
    });
    await sendMessage(buildText(phone, MESSAGES.PWD_ASK_CONFIRM));
    return;
  }
  if (text !== data.new) {
    await updatePayload(phone, {
      flow: { name: "password", step: "new", data: { current: data.current } },
    });
    await sendMessage(buildText(phone, MESSAGES.PWD_MISMATCH));
    return;
  }

  const res = await callBusinessFunction("auth", {
    method: "POST",
    path: "/change-password",
    accessToken: auth.access_token,
    body: { current_password: data.current, new_password: data.new },
  });

  if (!res.ok) {
    log.warn("change-password failed", { phone, err: res.error });
    await sendMessage(buildText(phone, MESSAGES.PWD_WRONG_CURRENT));
    await updatePayload(phone, { flow: undefined }, { state: "in_menu", current_menu: MENU_IDS.HOME });
    await showHomeMenu(phone);
    return;
  }
  await sendMessage(buildText(phone, MESSAGES.PWD_UPDATED));
  await updatePayload(phone, { flow: undefined }, { state: "in_menu", current_menu: MENU_IDS.HOME });
  await showHomeMenu(phone);
}