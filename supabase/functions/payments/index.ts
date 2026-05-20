import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient, hasAnyRole } from "../_shared/auth.ts";
import { ok, paginated, errors } from "../_shared/response.ts";
import { applyFilters, applySort, parseListParams } from "../_shared/list-params.ts";
import {
  detectProvider,
  initiateC2B,
  normalizePhone,
  PROVIDERS,
  type ProviderName,
} from "../_shared/avadapay.ts";

const router = new Router("/payments");

// GET /payments — scoped automatically by RLS via ctx.client
router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const params = parseListParams(url);

  let q = ctx.client.from("payments").select("*", { count: "exact" });

  // Parent extra-narrow scope: limit to their children
  if (ctx.roles.includes("parent") && !ctx.roles.includes("super_admin")) {
    const admin = adminClient();
    const { data: links } = await admin
      .from("parent_students")
      .select("student_id")
      .eq("parent_user_id", ctx.userId);
    const ids = (links ?? []).map((l) => l.student_id);
    if (ids.length === 0) return paginated([], params.page, params.limit, 0);
    q = q.in("student_id", ids);
  }

  if (params.search) {
    q = q.or(`reference.ilike.%${params.search}%`);
  }
  q = applyFilters(q, params.filters);
  q = params.sort.length ? applySort(q, params.sort) : q.order("created_at", { ascending: false });
  q = q.range((params.page - 1) * params.limit, params.page * params.limit - 1);
  const { data, count, error } = await q;
  if (error) return errors.internal(error.message);
  return paginated(data ?? [], params.page, params.limit, count ?? 0);
});

interface InitiateBody {
  fee_id?: string;
  student_id?: string;
  amount?: number;
  method?: string;
  reference?: string;
  phone?: string;
  provider?: ProviderName;
}

router.post("/initiate", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const body = (await req.json().catch(() => ({}))) as InitiateBody;

  const errs: { field: string; message: string }[] = [];
  if (!body.fee_id) errs.push({ field: "fee_id", message: "required" });
  if (!body.student_id) errs.push({ field: "student_id", message: "required" });
  if (!body.amount || body.amount <= 0) errs.push({ field: "amount", message: "must be > 0" });
  if (!body.method) errs.push({ field: "method", message: "required" });
  if (errs.length) return errors.validation("Validation failed", errs);

  const admin = adminClient();

  // Permission check
  const isParent = ctx.roles.includes("parent");
  const isCashierOrAdmin = hasAnyRole(ctx, ["cashier", "admin", "super_admin"]);
  if (!isParent && !isCashierOrAdmin) return errors.scopeForbidden();

  if (isParent && !ctx.roles.includes("super_admin")) {
    const { data: link } = await admin
      .from("parent_students")
      .select("id")
      .eq("parent_user_id", ctx.userId)
      .eq("student_id", body.student_id!)
      .maybeSingle();
    if (!link) return errors.scopeForbidden("Not your child");
  }

  const { data: fee } = await admin.from("fees").select("school_id, currency").eq("id", body.fee_id!).maybeSingle();
  if (!fee) return errors.notFound("Fee not found");

  // --- MOBILE_MONEY via AvadaPay --------------------------------------------
  if (body.method === "MOBILE_MONEY") {
    if (fee.currency !== "CDF") {
      return errors.validation("AvadaPay Mobile Money n'accepte que les paiements en CDF.");
    }
    const rawPhone = body.phone ?? body.reference ?? "";
    const phone = normalizePhone(rawPhone);
    if (phone.length < 9) {
      return errors.validation("Numéro de téléphone invalide.", [
        { field: "phone", message: "9 chiffres requis (sans 0 ni indicatif)" },
      ]);
    }
    const providerName = (body.provider as ProviderName | undefined) ?? detectProvider(phone);
    if (!providerName) {
      return errors.validation("Opérateur inconnu pour ce numéro.", [
        { field: "phone", message: "Préfixe non reconnu" },
      ]);
    }
    const providerCfg = PROVIDERS[providerName];

    // Create PENDING payment first so we have a stable order_id
    const { data: payment, error: payErr } = await admin
      .from("payments")
      .insert({
        fee_id: body.fee_id,
        student_id: body.student_id,
        school_id: fee.school_id,
        amount: body.amount,
        currency: fee.currency,
        method: "MOBILE_MONEY",
        status: "PENDING",
        reference: phone,
        initiated_by: ctx.userId,
      })
      .select()
      .single();
    if (payErr) return errors.validation(payErr.message);

    // Customer name from profile (fallback to email)
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, first_name, last_name, email")
      .eq("id", ctx.userId)
      .maybeSingle();
    const customerName =
      profile?.full_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      ctx.email ||
      "Client AvadaSchool";

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";

    const result = await initiateC2B({
      orderId: payment.id,
      amount: Number(body.amount),
      currency: fee.currency,
      phone,
      providerId: providerCfg.id,
      customerName,
      customerEmail: profile?.email ?? ctx.email ?? undefined,
      customerUserId: ctx.userId,
      customerIp: ip,
    });

    if (!result.ok) {
      // Mark FAILED if available, otherwise leave PENDING
      await admin
        .from("payments")
        .update({ status: "FAILED" })
        .eq("id", payment.id);
      const msg =
        (result.data as { message?: string; error?: string })?.message ??
        (result.data as { error?: string })?.error ??
        `AvadaPay a refusé la requête (HTTP ${result.status}).`;
      return errors.validation(msg, result.data);
    }

    return ok(
      {
        payment,
        receipt: null,
        provider: providerName,
        avadapay: result.data,
      },
      201,
      "Paiement initié — confirmez sur votre téléphone.",
    );
  }

  // --- CARD (mock pour l'instant) -------------------------------------------
  const { data: payment, error: payErr } = await admin
    .from("payments")
    .insert({
      fee_id: body.fee_id,
      student_id: body.student_id,
      school_id: fee.school_id,
      amount: body.amount,
      currency: fee.currency,
      method: body.method,
      status: "COMPLETED",
      reference: body.reference ?? `CARD-${Date.now()}`,
      paid_at: new Date().toISOString(),
      initiated_by: ctx.userId,
    })
    .select()
    .single();
  if (payErr) return errors.validation(payErr.message);

  const receiptNumber = `R-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { data: receipt } = await admin
    .from("receipts")
    .insert({
      payment_id: payment.id,
      receipt_number: receiptNumber,
      pdf_url: null,
    })
    .select()
    .single();

  if (isParent) {
    await admin.from("notifications").insert({
      user_id: ctx.userId,
      type: "PAYMENT",
      title: "Paiement confirmé",
      message: `Votre paiement de ${body.amount} ${fee.currency} a été enregistré.`,
      data: { paymentId: payment.id, receiptId: receipt?.id },
    });
  }

  return ok({ payment, receipt, checkoutUrl: null }, 201, "Payment initiated");
});

Deno.serve((req) => router.handle(req));
