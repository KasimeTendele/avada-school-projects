import { Router } from "../_shared/router.ts";
import { adminClient, userClient } from "../_shared/auth.ts";
import { ok, errors } from "../_shared/response.ts";

const router = new Router("/auth");

interface LoginBody { email?: string; password?: string }
interface RegisterBody { email?: string; password?: string; full_name?: string; phone?: string; role?: string }
interface ForgotBody { email?: string; redirect_to?: string }
interface ResetBody { access_token?: string; refresh_token?: string; new_password?: string }
interface RefreshBody { refresh_token?: string }
interface ChangePasswordBody { current_password?: string; new_password?: string }

router.post("/login", async (req) => {
  const body = (await req.json().catch(() => ({}))) as LoginBody;
  if (!body.email || !body.password) {
    return errors.validation("email and password are required", [
      { field: "email", message: "required" },
      { field: "password", message: "required" },
    ]);
  }
  const sb = userClient(null);
  const { data, error } = await sb.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });
  if (error || !data.session) return errors.unauthorized(error?.message ?? "Invalid credentials");
  const admin = adminClient();
  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", data.user!.id),
    admin.from("profiles").select("*").eq("id", data.user!.id).maybeSingle(),
  ]);
  return ok({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
    expiresAt: data.session.expires_at,
    user: {
      id: data.user!.id,
      email: data.user!.email,
      role: roleRows?.[0]?.role ?? "parent",
      roles: (roleRows ?? []).map((r) => r.role),
      schoolId: profile?.primary_school_id ?? null,
      profile,
    },
  });
});

router.post("/register", async (req) => {
  const body = (await req.json().catch(() => ({}))) as RegisterBody;
  if (!body.email || !body.password) {
    return errors.validation("email and password are required");
  }
  const admin = adminClient();
  // Check uniqueness via signUp; trigger creates profile + role
  const sb = userClient(null);
  const { data, error } = await sb.auth.signUp({
    email: body.email,
    password: body.password,
    options: {
      data: {
        full_name: body.full_name ?? "",
        phone: body.phone ?? null,
        role: body.role ?? "parent",
      },
    },
  });
  if (error) {
    if (error.message?.toLowerCase().includes("registered")) {
      return errors.conflict("Email already registered");
    }
    return errors.validation(error.message);
  }
  const session = data.session;
  return ok(
    {
      pendingActivation: !session,
      user: { id: data.user?.id, email: data.user?.email },
      session: session
        ? {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresIn: session.expires_in,
            expiresAt: session.expires_at,
          }
        : null,
    },
    201,
    "Account created",
  );
});

router.post("/forgot-password", async (req) => {
  const body = (await req.json().catch(() => ({}))) as ForgotBody;
  if (!body.email) return errors.validation("email is required");
  const redirectTo =
    body.redirect_to ??
    Deno.env.get("APP_RESET_REDIRECT_URL") ??
    undefined;
  const admin = adminClient();
  // Génère le lien de récupération via l'API admin (ne déclenche pas l'email Supabase
  // car nous l'envoyons nous-mêmes via notre SMTP). Si l'email n'existe pas, on
  // répond 200 quand même (anti-énumération).
  const { data, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: body.email,
    options: redirectTo ? { redirectTo } : undefined,
  });
  if (linkErr || !data?.properties?.action_link) {
    console.warn("[forgot-password] generateLink:", linkErr?.message);
    return ok({ sent: true }, 200, "Reset instructions sent if account exists");
  }
  const actionLink = data.properties.action_link;
  try {
    const { sendMail } = await import("../_shared/mailer.ts");
    await sendMail({
      to: body.email,
      subject: "Réinitialisation de votre mot de passe — Avada School",
      html: buildResetEmail(actionLink),
      text:
        "Bonjour,\n\nVous avez demandé la réinitialisation de votre mot de passe.\n" +
        `Cliquez sur ce lien pour le réinitialiser : ${actionLink}\n\n` +
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nAvada School",
    });
  } catch (e) {
    console.error("[forgot-password] SMTP send failed:", (e as Error).message);
    return errors.internal("Email delivery failed");
  }
  return ok({ sent: true }, 200, "Reset instructions sent if account exists");
});

function buildResetEmail(link: string): string {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f8fa;padding:24px;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
    <h1 style="margin:0 0 12px;font-size:22px;color:#10b981">Réinitialisation du mot de passe</h1>
    <p style="font-size:15px;line-height:1.5">Bonjour,</p>
    <p style="font-size:15px;line-height:1.5">Vous avez demandé à réinitialiser votre mot de passe Avada School. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${link}" style="background:#10b981;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;display:inline-block">Réinitialiser mon mot de passe</a>
    </p>
    <p style="font-size:13px;color:#64748b;line-height:1.5">Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br/><a href="${link}" style="color:#10b981;word-break:break-all">${link}</a></p>
    <p style="font-size:13px;color:#64748b;line-height:1.5">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
    <p style="font-size:12px;color:#94a3b8;margin:0">© Avada School</p>
  </div></body></html>`;
}

router.post("/reset-password", async (req) => {
  const body = (await req.json().catch(() => ({}))) as ResetBody;
  if (!body.access_token || !body.new_password) {
    return errors.validation("access_token and new_password are required");
  }
  const sb = userClient(`Bearer ${body.access_token}`);
  if (body.refresh_token) {
    await sb.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    });
  }
  const { error } = await sb.auth.updateUser({ password: body.new_password });
  if (error) return errors.validation(error.message);
  return ok({ updated: true }, 200, "Password updated");
});

router.post("/refresh", async (req) => {
  const body = (await req.json().catch(() => ({}))) as RefreshBody;
  if (!body.refresh_token) return errors.validation("refresh_token is required");
  const sb = userClient(null);
  const { data, error } = await sb.auth.refreshSession({ refresh_token: body.refresh_token });
  if (error || !data.session) return errors.unauthorized(error?.message ?? "Invalid refresh token");
  return ok({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
    expiresAt: data.session.expires_at,
  });
});

// POST /auth/change-password
// Auth: Bearer required. Vérifie l'ancien mot de passe puis met à jour
// le mot de passe et désactive le flag must_change_password.
router.post("/change-password", async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return errors.unauthorized("Missing bearer token");
  const body = (await req.json().catch(() => ({}))) as ChangePasswordBody;
  if (!body.current_password || !body.new_password) {
    return errors.validation("current_password and new_password are required");
  }
  if (body.new_password.length < 8) {
    return errors.validation("new_password must be at least 8 characters");
  }
  const admin = adminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.slice(7));
  if (userErr || !userData.user?.email) return errors.unauthorized("Invalid token");
  // Re-vérifier l'ancien mot de passe via signIn (sans toucher la session courante).
  const verifier = userClient(null);
  const { error: signErr } = await verifier.auth.signInWithPassword({
    email: userData.user.email,
    password: body.current_password,
  });
  if (signErr) return errors.unauthorized("Current password is incorrect");
  const { error: updErr } = await admin.auth.admin.updateUserById(userData.user.id, {
    password: body.new_password,
    user_metadata: { ...(userData.user.user_metadata ?? {}), must_change_password: false },
  });
  if (updErr) return errors.validation(updErr.message);
  return ok({ updated: true }, 200, "Password updated");
});

Deno.serve((req) => router.handle(req));
