/**
 * Parent authentication flow driven from WhatsApp.
 * Reuses the existing `/auth/login` Edge Function — no password logic here.
 */
import { callBusinessFunction } from "../api.ts";
import { MAX_LOGIN_ATTEMPTS } from "../constants.ts";
import { createLogger } from "../logger.ts";
import { MESSAGES } from "../messages.ts";
import { buildText, sendMessage } from "../send.ts";
import { getPayload, getSession, updatePayload } from "../session.ts";
import { getSupabase } from "../supabase.ts";
import type { WhatsAppAuthState } from "../types.ts";
import { showHomeMenu } from "../menu.ts";

const log = createLogger("whatsapp:auth");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function startAuthFlow(phone: string, greeting = true): Promise<void> {
  if (greeting) await sendMessage(buildText(phone, MESSAGES.AUTH_WELCOME));
  else await sendMessage(buildText(phone, MESSAGES.AUTH_ASK_EMAIL));
  await updatePayload(phone, { pending_email: undefined }, { state: "awaiting_email", current_menu: null });
}

export async function handleEmailInput(phone: string, raw: string): Promise<void> {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    await sendMessage(buildText(phone, MESSAGES.AUTH_INVALID_EMAIL));
    return;
  }
  await updatePayload(phone, { pending_email: email }, { state: "awaiting_password" });
  await sendMessage(buildText(phone, MESSAGES.AUTH_ASK_PASSWORD));
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    roles?: string[];
    profile?: {
      first_name?: string | null;
      last_name?: string | null;
      full_name?: string | null;
    } | null;
  };
}

export async function handlePasswordInput(phone: string, password: string): Promise<void> {
  const session = await getSession(phone);
  const payload = getPayload(session);
  const email = payload.pending_email;
  if (!email) {
    await startAuthFlow(phone, false);
    return;
  }
  const attempts = (payload.login_attempts ?? 0) + 1;

  const res = await callBusinessFunction<LoginResponse>("auth", {
    method: "POST",
    path: "/login",
    body: { email, password },
  });

  if (!res.ok || !res.data?.accessToken) {
    log.warn("Login failed", { phone, email, attempts, err: res.error });
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      await sendMessage(buildText(phone, MESSAGES.AUTH_FAILED_LOCKED));
      await updatePayload(
        phone,
        { pending_email: undefined, login_attempts: 0, auth: undefined },
        { state: "closed", current_menu: null },
      );
      return;
    }
    await updatePayload(
      phone,
      { pending_email: undefined, login_attempts: attempts },
      { state: "awaiting_email" },
    );
    await sendMessage(buildText(phone, MESSAGES.AUTH_FAILED_RETRY(MAX_LOGIN_ATTEMPTS - attempts)));
    return;
  }

  const user = res.data.user;
  const roles = user.roles ?? [];
  if (!roles.includes("parent") && !roles.includes("super_admin")) {
    await sendMessage(buildText(phone, "🚫 Ce canal est réservé aux comptes parents."));
    await updatePayload(phone, { pending_email: undefined, login_attempts: 0 }, { state: "closed" });
    return;
  }

  const firstName =
    user.profile?.first_name ??
    (user.profile?.full_name ? user.profile.full_name.split(" ")[0] : null) ??
    email.split("@")[0];
  const lastName = user.profile?.last_name ?? "";

  const auth: WhatsAppAuthState = {
    user_id: user.id,
    email: user.email,
    first_name: firstName,
    last_name: lastName,
    access_token: res.data.accessToken,
    refresh_token: res.data.refreshToken,
    login_time: new Date().toISOString(),
  };

  await updatePayload(
    phone,
    { auth, pending_email: undefined, login_attempts: 0, flow: undefined },
    { state: "in_menu" },
  );

  try {
    await getSupabase().from("whatsapp_users").upsert(
      {
        phone_number: phone,
        user_id: user.id,
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        last_connected_at: new Date().toISOString(),
      },
      { onConflict: "phone_number" },
    );
  } catch (err) {
    log.error("whatsapp_users upsert failed", { err: (err as Error).message });
  }

  log.info("Login OK", { phone, userId: user.id });
  await showHomeMenu(phone, firstName);
}