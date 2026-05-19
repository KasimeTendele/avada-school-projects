import { Router } from "../_shared/router.ts";
import { requireAuth, adminClient } from "../_shared/auth.ts";
import { ok, errors } from "../_shared/response.ts";

const router = new Router("/receipts");

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
