import { callBusinessFunction } from "../api.ts";
import { MENU_IDS } from "../constants.ts";
import { createLogger } from "../logger.ts";
import { MESSAGES } from "../messages.ts";
import { buildDocument, buildList, buildText, sendMessage } from "../send.ts";
import { getPayload, getSession, updatePayload } from "../session.ts";
import { fetchChildren, fetchFees } from "./fees.ts";
import { showHomeMenu } from "../menu.ts";

const log = createLogger("whatsapp:payment");

type Step = "select_child" | "select_fee" | "select_method" | "enter_phone" | "confirming";
interface Data {
  studentId?: string;
  feeId?: string;
  amount?: number;
  currency?: string;
  method?: "MOBILE_MONEY";
  paymentId?: string;
}

export async function startPaymentFlow(phone: string, presetStudentId?: string): Promise<void> {
  const auth = getPayload(await getSession(phone)).auth;
  if (!auth) return;

  if (presetStudentId) {
    await updatePayload(
      phone,
      { flow: { name: "payment", step: "select_fee", data: { studentId: presetStudentId } } },
      { state: "awaiting_payment", current_menu: MENU_IDS.PAYMENT },
    );
    await promptFeeSelection(phone, presetStudentId, auth.access_token);
    return;
  }

  const children = await fetchChildren(auth.access_token);
  if (children.length === 0) {
    await sendMessage(buildText(phone, MESSAGES.FEES_NO_CHILDREN));
    return;
  }
  const rows = children.slice(0, 10).map((c) => ({
    id: `pay:child:${c.id}`,
    title: `${c.first_name} ${c.last_name}`.slice(0, 24),
    description: c.class?.name ? `Classe : ${c.class.name}` : undefined,
  }));
  await sendMessage(
    buildList(phone, "Pour quel enfant souhaitez-vous payer ?", "Choisir", [
      { title: "Enfants", rows },
    ]),
  );
  await updatePayload(
    phone,
    { flow: { name: "payment", step: "select_child", data: {} } },
    { state: "awaiting_payment", current_menu: MENU_IDS.PAYMENT },
  );
}

async function promptFeeSelection(phone: string, studentId: string, accessToken: string): Promise<void> {
  const fees = (await fetchFees(accessToken)).filter(
    (f) => f.student.id === studentId && f.remaining > 0,
  );
  if (fees.length === 0) {
    await sendMessage(buildText(phone, "✅ Aucun frais impayé pour cet enfant."));
    await updatePayload(phone, { flow: undefined }, { state: "in_menu", current_menu: MENU_IDS.HOME });
    return;
  }
  const rows = fees.slice(0, 10).map((f) => ({
    id: `pay:fee:${f.fee_id}`,
    title: `${f.label}`.slice(0, 24),
    description: `${f.remaining} ${f.currency} restant`,
  }));
  await sendMessage(
    buildList(phone, MESSAGES.PAY_SELECT_FEE, "Choisir", [{ title: "Frais dus", rows }]),
  );
}

async function promptMethod(phone: string): Promise<void> {
  await sendMessage(
    buildList(phone, MESSAGES.PAY_SELECT_METHOD, "Choisir", [
      {
        title: "Moyen de paiement",
        rows: [
          { id: "pay:method:MOBILE_MONEY", title: "📱 Mobile Money", description: "Orange, Airtel, Vodacom, M-Pesa" },
        ],
      },
    ]),
  );
}

export async function handlePaymentFlow(
  phone: string,
  input: { kind: "text" | "menu"; value: string },
): Promise<void> {
  const session = await getSession(phone);
  const payload = getPayload(session);
  const flow = payload.flow;
  const auth = payload.auth;
  if (!flow || flow.name !== "payment" || !auth) return;

  const step = flow.step as Step;
  const data = (flow.data ?? {}) as Data;

  if (input.kind === "menu") {
    if (step === "select_child" && input.value.startsWith("pay:child:")) {
      const studentId = input.value.slice("pay:child:".length);
      await updatePayload(phone, {
        flow: { name: "payment", step: "select_fee", data: { studentId } },
      });
      await promptFeeSelection(phone, studentId, auth.access_token);
      return;
    }
    if (step === "select_fee" && input.value.startsWith("pay:fee:")) {
      const feeId = input.value.slice("pay:fee:".length);
      const fees = await fetchFees(auth.access_token);
      const fee = fees.find((f) => f.fee_id === feeId && f.student.id === data.studentId);
      if (!fee) {
        await sendMessage(buildText(phone, MESSAGES.INTERNAL_ERROR));
        return;
      }
      await updatePayload(phone, {
        flow: {
          name: "payment",
          step: "select_method",
          data: { ...data, feeId, amount: fee.remaining, currency: fee.currency },
        },
      });
      await promptMethod(phone);
      return;
    }
    if (step === "select_method" && input.value === "pay:method:MOBILE_MONEY") {
      await updatePayload(phone, {
        flow: { name: "payment", step: "enter_phone", data: { ...data, method: "MOBILE_MONEY" } },
      });
      await sendMessage(buildText(phone, MESSAGES.PAY_ASK_PHONE));
      return;
    }
  }

  if (input.kind === "text" && step === "enter_phone") {
    const digits = input.value.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 12) {
      await sendMessage(buildText(phone, MESSAGES.PAY_INVALID_PHONE));
      return;
    }
    if (!data.feeId || !data.studentId || !data.amount) {
      await sendMessage(buildText(phone, MESSAGES.INTERNAL_ERROR));
      return;
    }
    await initiatePayment(phone, auth.access_token, {
      feeId: data.feeId,
      studentId: data.studentId,
      amount: data.amount,
      phone: digits,
    });
    return;
  }

  await sendMessage(buildText(phone, MESSAGES.UNKNOWN_COMMAND));
}

interface InitiateOk {
  payment: { id: string; amount: number; currency: string; reference?: string | null; status?: string };
}

async function initiatePayment(
  phone: string,
  accessToken: string,
  args: { feeId: string; studentId: string; amount: number; phone: string },
): Promise<void> {
  const res = await callBusinessFunction<InitiateOk>("payments", {
    method: "POST",
    path: "/initiate",
    accessToken,
    body: {
      fee_id: args.feeId,
      student_id: args.studentId,
      amount: args.amount,
      method: "MOBILE_MONEY",
      phone: args.phone,
    },
  });
  if (!res.ok || !res.data?.payment) {
    log.warn("initiate failed", { phone, err: res.error });
    await sendMessage(buildText(phone, `❌ ${res.error ?? "Échec de l'initialisation du paiement."}`));
    await updatePayload(phone, { flow: undefined }, { state: "in_menu", current_menu: MENU_IDS.HOME });
    return;
  }
  const paymentId = res.data.payment.id;
  await sendMessage(buildText(phone, MESSAGES.PAY_INITIATED(paymentId)));
  const cur = getPayload(await getSession(phone)).flow?.data ?? {};
  await updatePayload(phone, {
    flow: { name: "payment", step: "confirming", data: { ...cur, paymentId } },
  });

  pollAndFinalize(phone, accessToken, paymentId).catch((err) =>
    log.error("pollAndFinalize failed", { phone, err: (err as Error).message }),
  );
}

interface VerifyResponse {
  payment: { id: string; status: string; amount: number; currency: string; reference?: string | null; paid_at?: string | null };
  receipt?: { id: string; receipt_number?: string | null; pdf_url?: string | null } | null;
}

async function pollAndFinalize(phone: string, accessToken: string, paymentId: string): Promise<void> {
  const attempts = 6;
  const delayMs = 8_000;
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    const res = await callBusinessFunction<VerifyResponse>("payments", {
      method: "POST",
      path: `/${paymentId}/verify`,
      accessToken,
    });
    const status = res.data?.payment?.status;
    if (status === "COMPLETED") {
      await announceSuccess(phone, res.data!);
      return;
    }
    if (status === "FAILED" || status === "CANCELLED") {
      await sendMessage(buildText(phone, MESSAGES.PAY_FAILED));
      await updatePayload(phone, { flow: undefined }, { state: "in_menu", current_menu: MENU_IDS.HOME });
      return;
    }
  }
  await sendMessage(buildText(phone, MESSAGES.PAY_PENDING_TIMEOUT));
  await updatePayload(phone, { flow: undefined }, { state: "in_menu", current_menu: MENU_IDS.HOME });
}

async function announceSuccess(phone: string, verify: VerifyResponse): Promise<void> {
  const p = verify.payment;
  const date = p.paid_at ? new Date(p.paid_at).toLocaleString("fr-FR") : new Date().toLocaleString("fr-FR");
  await sendMessage(
    buildText(
      phone,
      MESSAGES.PAY_SUCCESS({
        amount: String(p.amount),
        currency: p.currency,
        ref: p.reference ?? p.id,
        date,
      }),
    ),
  );
  const pdfUrl = verify.receipt?.pdf_url;
  const number = verify.receipt?.receipt_number ?? "recu";
  if (pdfUrl) {
    await sendMessage(buildDocument(phone, { link: pdfUrl, filename: `Recu-${number}.pdf`, caption: "Votre reçu AvadaSchool" }));
  } else {
    await sendMessage(
      buildText(
        phone,
        `🧾 Reçu N° *${number}*\nLe PDF sera disponible sous peu dans votre espace parent.`,
      ),
    );
  }
  await updatePayload(phone, { flow: undefined }, { state: "in_menu", current_menu: MENU_IDS.HOME });
  try { await showHomeMenu(phone); } catch { /* ignore */ }
}