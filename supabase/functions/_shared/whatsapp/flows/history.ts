import { callBusinessFunction } from "../api.ts";
import { MENU_IDS } from "../constants.ts";
import { MESSAGES } from "../messages.ts";
import { buildText, sendMessage } from "../send.ts";
import { getPayload, getSession, updatePayload } from "../session.ts";

interface ReceiptItem {
  amount: number;
  currency: string;
  reference?: string | null;
  paid_at?: string | null;
  fee_label?: string | null;
  student_name?: string | null;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function startHistoryFlow(phone: string): Promise<void> {
  const auth = getPayload(await getSession(phone)).auth;
  if (!auth) return;
  const res = await callBusinessFunction<{ items: ReceiptItem[] }>("receipts", {
    method: "GET",
    accessToken: auth.access_token,
    query: { limit: 10 },
  });
  if (!res.ok) {
    await sendMessage(buildText(phone, MESSAGES.INTERNAL_ERROR));
    return;
  }
  const items = res.data?.items ?? [];
  if (items.length === 0) {
    await sendMessage(buildText(phone, MESSAGES.HISTORY_EMPTY));
  } else {
    const lines = items.slice(0, 10).map((p, i) => {
      const child = p.student_name ? ` — ${p.student_name}` : "";
      const label = p.fee_label ? `\n   ${p.fee_label}` : "";
      return `*${i + 1}.* ${formatDate(p.paid_at)} — *${p.amount} ${p.currency}*${child}${label}${p.reference ? `\n   Réf. ${p.reference}` : ""}`;
    });
    await sendMessage(buildText(phone, `${MESSAGES.HISTORY_HEADER}\n\n${lines.join("\n\n")}`));
  }
  await updatePayload(phone, { flow: undefined }, { state: "in_menu", current_menu: MENU_IDS.HISTORY });
}