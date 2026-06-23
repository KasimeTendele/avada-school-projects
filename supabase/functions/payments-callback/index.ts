import { adminClient } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { signPayload } from "../_shared/avadapay.ts";
import { notifyStaffOfPayment } from "../_shared/notify-staff.ts";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface AvadaCallback {
  order_id?: string;
  status?: string;
  transaction_id?: string;
  amount?: string | number;
  currency?: string;
  signature?: string;
  [k: string]: unknown;
}

function isSuccess(status?: string): boolean {
  if (!status) return false;
  const s = status.toUpperCase();
  return ["SUCCESS", "COMPLETED", "PAID", "OK", "APPROVED"].includes(s);
}

function isFailure(status?: string): boolean {
  if (!status) return false;
  const s = status.toUpperCase();
  return ["FAILED", "FAILURE", "REJECTED", "CANCELLED", "CANCELED", "ERROR"].includes(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, message: "Method not allowed" });

  let payload: AvadaCallback;
  try {
    payload = (await req.json()) as AvadaCallback;
  } catch {
    return json(400, { success: false, message: "Invalid JSON" });
  }

  const orderId = payload.order_id;
  if (!orderId) return json(400, { success: false, message: "order_id missing" });

  // Verify signature when present
  if (payload.signature) {
    const { signature: _omit, ...rest } = payload;
    const expected = await signPayload(rest as Record<string, unknown>);
    if (expected.toLowerCase() !== String(payload.signature).toLowerCase()) {
      console.warn("[avadapay-callback] signature mismatch", { orderId });
      return json(401, { success: false, message: "Invalid signature" });
    }
  }

  const admin = adminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, status, school_id, student_id, fee_id, amount, currency, method, reference, initiated_by")
    .eq("id", orderId)
    .maybeSingle();

  if (!payment) return json(404, { success: false, message: "Payment not found" });
  if (payment.status === "COMPLETED") {
    return json(200, { success: true, message: "Already processed" });
  }

  if (isFailure(payload.status)) {
    await admin.from("payments").update({ status: "FAILED" }).eq("id", payment.id);
    if (payment.initiated_by) {
      await admin.from("notifications").insert({
        user_id: payment.initiated_by,
        type: "PAYMENT",
        title: "Paiement échoué",
        message: `Votre paiement de ${payment.amount} ${payment.currency} a échoué.`,
        data: { paymentId: payment.id },
      });
    }
    return json(200, { success: true, message: "Marked failed" });
  }

  if (!isSuccess(payload.status)) {
    // Pending/unknown — ignore but ack
    return json(200, { success: true, message: "Ignored (non-final status)" });
  }

  // SUCCESS → COMPLETED + receipt + notification
  await admin
    .from("payments")
    .update({
      status: "COMPLETED",
      paid_at: new Date().toISOString(),
      reference: payload.transaction_id ?? undefined,
    })
    .eq("id", payment.id);

  const receiptNumber = `R-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { data: receipt } = await admin
    .from("receipts")
    .insert({ payment_id: payment.id, receipt_number: receiptNumber, pdf_url: null })
    .select()
    .single();

  if (payment.initiated_by) {
    await admin.from("notifications").insert({
      user_id: payment.initiated_by,
      type: "PAYMENT",
      title: "Paiement confirmé",
      message: `Votre paiement de ${payment.amount} ${payment.currency} a été reçu.`,
      data: { paymentId: payment.id, receiptId: receipt?.id },
    });
  }

  await notifyStaffOfPayment({
    paymentId: payment.id,
    schoolId: payment.school_id,
    studentId: payment.student_id,
    feeId: payment.fee_id,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    reference: payload.transaction_id ?? payment.reference ?? null,
    receiptId: receipt?.id ?? null,
    initiatedBy: payment.initiated_by,
  });

  return json(200, { success: true, message: "Payment completed" });
});