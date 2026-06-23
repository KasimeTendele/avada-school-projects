import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient } from "../_shared/auth.ts";
import { ok, errors } from "../_shared/response.ts";
import { enrichPayments } from "../_shared/payment-enrich.ts";

const router = new Router("/receipts");

// GET /receipts — liste des reçus du parent (paiements COMPLETED) enrichie
// avec téléphone, opérateur, motif, classe, école, etc.
router.get("/", async (req) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

  // RLS s'occupe du scope : un parent ne voit que ses paiements,
  // un cashier/admin voit ceux de son école, un super_admin voit tout.
  let q = ctx.client
    .from("payments")
    .select("id,fee_id,student_id,school_id,initiated_by,amount,currency,method,status,reference,paid_at,created_at")
    .eq("status", "COMPLETED")
    .order("paid_at", { ascending: false })
    .limit(limit);

  // Restriction parent : uniquement leurs enfants
  if (ctx.roles.includes("parent") && !ctx.roles.includes("super_admin")) {
    const admin = adminClient();
    const { data: links } = await admin
      .from("parent_students")
      .select("student_id")
      .eq("parent_user_id", ctx.userId);
    const ids = (links ?? []).map((l) => l.student_id);
    if (ids.length === 0) return ok({ items: [] });
    q = q.in("student_id", ids);
  }

  const { data, error } = await q;
  if (error) return errors.internal(error.message);
  const items = await enrichPayments((data ?? []) as Array<Record<string, unknown>>);
  return ok({ items });
});

router.get("/:id/pdf", async (req, params) => {
  const ctx = await requireAuth(req);
  if (ctx instanceof Response) return ctx;
  // Use user client so RLS enforces scoping
  const { data: receipt, error } = await ctx.client
    .from("receipts")
    .select("id, payment_id, receipt_number, pdf_url")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return errors.internal(error.message);
  if (!receipt) return errors.notFound("Receipt not found or out of scope");

  let url = receipt.pdf_url;
  if (!url) {
    // MOCK: lazy-generate a placeholder URL.
    url = `https://placehold.co/receipts/${receipt.receipt_number}.pdf`;
    const admin = adminClient();
    await admin.from("receipts").update({ pdf_url: url }).eq("id", receipt.id);
  }
  return ok({ url, receiptNumber: receipt.receipt_number });
});

Deno.serve((req) => router.handle(req));
