import { callBusinessFunction } from "../api.ts";
import { ACTIONS, MENU_IDS } from "../constants.ts";
import { MESSAGES } from "../messages.ts";
import { buildButtons, buildList, buildText, sendMessage } from "../send.ts";
import { getPayload, getSession, updatePayload } from "../session.ts";

export interface FeesItem {
  fee_id: string;
  label: string;
  amount: number;
  currency: string;
  paid: number;
  remaining: number;
  academic_year?: string | null;
  student: { id: string; first_name: string; last_name: string };
}

export interface ChildRow {
  id: string;
  first_name: string;
  last_name: string;
  class?: { name?: string | null; academic_year?: string | null } | null;
}

export async function fetchChildren(accessToken: string): Promise<ChildRow[]> {
  const res = await callBusinessFunction<{ items: ChildRow[] }>("students-by-parent", {
    method: "GET",
    accessToken,
  });
  return res.data?.items ?? [];
}

export async function fetchFees(accessToken: string): Promise<FeesItem[]> {
  const res = await callBusinessFunction<{ items: FeesItem[] }>("fees-by-parent", {
    method: "GET",
    accessToken,
  });
  return res.data?.items ?? [];
}

export async function startFeesFlow(phone: string): Promise<void> {
  const auth = getPayload(await getSession(phone)).auth;
  if (!auth) return;
  const children = await fetchChildren(auth.access_token);
  if (children.length === 0) {
    await sendMessage(buildText(phone, MESSAGES.FEES_NO_CHILDREN));
    await updatePayload(phone, { flow: undefined }, { state: "in_menu", current_menu: MENU_IDS.HOME });
    return;
  }
  const rows = children.slice(0, 10).map((c) => ({
    id: `fees:child:${c.id}`,
    title: `${c.first_name} ${c.last_name}`.slice(0, 24),
    description: c.class?.name ? `Classe : ${c.class.name}` : undefined,
  }));
  await sendMessage(
    buildList(phone, MESSAGES.FEES_SELECT_CHILD, MESSAGES.FEES_LIST_BUTTON, [
      { title: MESSAGES.FEES_LIST_TITLE, rows },
    ]),
  );
  await updatePayload(
    phone,
    { flow: { name: "fees", step: "child_selected", data: {} } },
    { state: "in_menu", current_menu: MENU_IDS.FEES },
  );
}

export async function handleFeesChildSelected(phone: string, studentId: string): Promise<void> {
  const auth = getPayload(await getSession(phone)).auth;
  if (!auth) return;
  const [fees, children] = await Promise.all([
    fetchFees(auth.access_token),
    fetchChildren(auth.access_token),
  ]);
  const child = children.find((c) => c.id === studentId);
  const feesForChild = fees.filter((f) => f.student.id === studentId && f.remaining > 0);
  const displayName = child ? `${child.first_name} ${child.last_name}` : "l'élève";

  if (feesForChild.length === 0) {
    await sendMessage(buildText(phone, MESSAGES.FEES_NO_DUE(displayName)));
    await updatePayload(phone, { flow: undefined }, { state: "in_menu", current_menu: MENU_IDS.HOME });
    return;
  }

  const total = feesForChild.reduce((s, f) => s + f.amount, 0);
  const paid = feesForChild.reduce((s, f) => s + f.paid, 0);
  const remaining = feesForChild.reduce((s, f) => s + f.remaining, 0);
  const currency = feesForChild[0].currency;
  const academic = feesForChild[0].academic_year ?? child?.class?.academic_year ?? "—";
  const className = child?.class?.name ?? "—";
  const list = feesForChild
    .map((f) => `• ${f.label} — *${f.remaining} ${f.currency}* restant sur ${f.amount}`)
    .join("\n");
  const summary =
    `👦 *${displayName}*\n🏫 Classe : ${className}\n📅 Année : ${academic}\n\n` +
    `${list}\n\n💰 Total : *${total} ${currency}*\n✅ Payé : *${paid} ${currency}*\n🧾 Solde : *${remaining} ${currency}*`;
  await sendMessage(
    buildButtons(phone, summary, [
      { type: "reply", reply: { id: `${ACTIONS.PAY_NOW}:${studentId}`, title: "✅ Payer maintenant" } },
      { type: "reply", reply: { id: ACTIONS.BACK, title: "⬅ Retour" } },
    ]),
  );
  await updatePayload(
    phone,
    { flow: { name: "fees", step: "summary", data: { studentId } } },
    { state: "in_menu", current_menu: MENU_IDS.FEES },
  );
}