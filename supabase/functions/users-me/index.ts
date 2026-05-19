import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient } from "../_shared/auth.ts";
import { ok, errors } from "../_shared/response.ts";

const router = new Router("/users-me");

router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const admin = adminClient();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", ctx.userId).maybeSingle();
  return ok({
    id: ctx.userId,
    email: ctx.email,
    roles: ctx.roles,
    role: ctx.roles[0] ?? "parent",
    schoolId: ctx.primarySchoolId,
    profile,
  });
});

router.patch("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const allowed = ["full_name", "email", "phone", "avatar_url"];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) update[k] = body[k];
  if (Object.keys(update).length === 0) return errors.validation("No allowed fields provided");

  if (typeof update.email === "string" && update.email !== ctx.email) {
    const admin = adminClient();
    const { data: existing } = await admin.from("profiles").select("id").eq("email", update.email).neq("id", ctx.userId).maybeSingle();
    if (existing) return errors.conflict("Email already in use");
    const { error: emailErr } = await admin.auth.admin.updateUserById(ctx.userId, { email: update.email as string });
    if (emailErr) return errors.validation(emailErr.message);
  }

  const admin = adminClient();
  const { data, error } = await admin.from("profiles").update(update).eq("id", ctx.userId).select().single();
  if (error) return errors.validation(error.message);
  return ok({ profile: data });
});

router.patch("/password", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const body = (await req.json().catch(() => ({}))) as { current_password?: string; new_password?: string };
  if (!body.current_password || !body.new_password) {
    return errors.validation("current_password and new_password are required");
  }
  // Re-verify current password
  const sb = adminClient();
  const { error: signErr } = await sb.auth.signInWithPassword({
    email: ctx.email!,
    password: body.current_password,
  });
  if (signErr) return errors.unauthorized("Current password is incorrect");
  const { error } = await sb.auth.admin.updateUserById(ctx.userId, { password: body.new_password });
  if (error) return errors.validation(error.message);
  return ok({ updated: true });
});

router.get("/preferences/notifications", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const admin = adminClient();
  let { data } = await admin.from("notification_preferences").select("*").eq("user_id", ctx.userId).maybeSingle();
  if (!data) {
    const ins = await admin.from("notification_preferences").insert({ user_id: ctx.userId }).select().single();
    data = ins.data;
  }
  return ok({ preferences: data });
});

router.patch("/preferences/notifications", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const allowed = ["payments", "reminders", "events", "system", "push_enabled", "email_enabled"];
  const update: Record<string, unknown> = { user_id: ctx.userId };
  for (const k of allowed) if (k in body) update[k] = body[k];
  const admin = adminClient();
  const { data, error } = await admin
    .from("notification_preferences")
    .upsert(update, { onConflict: "user_id" })
    .select()
    .single();
  if (error) return errors.validation(error.message);
  return ok({ preferences: data });
});

router.put("/push-token", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const body = (await req.json().catch(() => ({}))) as { token?: string | null; platform?: string; device_id?: string };
  const admin = adminClient();
  if (!body.token) {
    // Empty -> remove device token
    if (body.device_id) {
      await admin.from("push_tokens").delete().eq("user_id", ctx.userId).eq("device_id", body.device_id);
    } else {
      await admin.from("push_tokens").delete().eq("user_id", ctx.userId);
    }
    return ok({ cleared: true });
  }
  const { data, error } = await admin
    .from("push_tokens")
    .upsert(
      { user_id: ctx.userId, token: body.token, platform: body.platform ?? null, device_id: body.device_id ?? null },
      { onConflict: "user_id,token" },
    )
    .select()
    .single();
  if (error) return errors.validation(error.message);
  return ok({ pushToken: data });
});

Deno.serve((req) => router.handle(req));
