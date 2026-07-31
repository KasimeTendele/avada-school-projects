/**
 * Outils exposés au modèle. Chaque outil est un simple adaptateur vers une
 * Edge Function métier existante ou vers un parcours WhatsApp déjà implémenté.
 * AUCUNE logique métier ne doit vivre ici.
 *
 * Ajouter un outil = ajouter une entrée dans TOOLS (nom, schéma, run).
 */
import { callBusinessFunction } from "../_shared/whatsapp/api.ts";
import { MENU_IDS } from "../_shared/whatsapp/constants.ts";
import { fetchChildren, fetchFees } from "../_shared/whatsapp/flows/fees.ts";
import { startPaymentFlow } from "../_shared/whatsapp/flows/payment.ts";
import type { ChatToolDefinition } from "../_shared/openai/responses.ts";
import type { AssistantContext, ToolHandler, ToolResult } from "./types.ts";

const AUTH_REQUIRED: ToolResult = {
  ok: false,
  error: "Parent non authentifié. Invitez-le à taper *menu* pour se connecter.",
};

function token(ctx: AssistantContext): string | null {
  return ctx.authenticated && ctx.accessToken ? ctx.accessToken : null;
}

export const TOOLS: ToolHandler[] = [
  {
    name: "getChildren",
    description:
      "Liste les enfants (élèves) rattachés au compte du parent authentifié : nom, classe, année scolaire.",
    requiresAuth: true,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async run(_args, ctx) {
      const t = token(ctx);
      if (!t) return AUTH_REQUIRED;
      const items = await fetchChildren(t);
      return { ok: true, data: { count: items.length, children: items } };
    },
  },
  {
    name: "getFees",
    description:
      "Retourne les frais scolaires du parent (montant, payé, solde). Filtrable par identifiant d'élève.",
    requiresAuth: true,
    parameters: {
      type: "object",
      properties: {
        studentId: { type: "string", description: "UUID de l'élève (facultatif)." },
        onlyUnpaid: { type: "boolean", description: "Ne garder que les frais avec un solde." },
      },
      additionalProperties: false,
    },
    async run(args, ctx) {
      const t = token(ctx);
      if (!t) return AUTH_REQUIRED;
      const studentId = typeof args.studentId === "string" ? args.studentId : undefined;
      const onlyUnpaid = args.onlyUnpaid !== false;
      let items = await fetchFees(t);
      if (studentId) items = items.filter((f) => f.student?.id === studentId);
      if (onlyUnpaid) items = items.filter((f) => f.remaining > 0);
      const totals = items.reduce(
        (acc, f) => ({
          amount: acc.amount + f.amount,
          paid: acc.paid + f.paid,
          remaining: acc.remaining + f.remaining,
          currency: f.currency ?? acc.currency,
        }),
        { amount: 0, paid: 0, remaining: 0, currency: "USD" },
      );
      return { ok: true, data: { count: items.length, totals, fees: items } };
    },
  },
  {
    name: "paymentHistory",
    description: "Retourne les derniers paiements du parent (date, montant, référence, élève).",
    requiresAuth: true,
    parameters: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 20 } },
      additionalProperties: false,
    },
    async run(args, ctx) {
      const t = token(ctx);
      if (!t) return AUTH_REQUIRED;
      const limit = Math.min(Math.max(Number(args.limit ?? 10) || 10, 1), 20);
      const res = await callBusinessFunction<{ items: unknown[] }>("receipts", {
        method: "GET",
        accessToken: t,
        query: { limit },
      });
      if (!res.ok) return { ok: false, error: res.error ?? "Service indisponible." };
      return { ok: true, data: { payments: res.data?.items ?? [] } };
    },
  },
  {
    name: "getReceipts",
    description:
      "Retourne les reçus de paiement du parent (référence, montant, lien de reçu si disponible).",
    requiresAuth: true,
    parameters: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 20 } },
      additionalProperties: false,
    },
    async run(args, ctx) {
      const t = token(ctx);
      if (!t) return AUTH_REQUIRED;
      const limit = Math.min(Math.max(Number(args.limit ?? 5) || 5, 1), 20);
      const res = await callBusinessFunction<{ items: unknown[] }>("receipts", {
        method: "GET",
        accessToken: t,
        query: { limit },
      });
      if (!res.ok) return { ok: false, error: res.error ?? "Service indisponible." };
      return { ok: true, data: { receipts: res.data?.items ?? [] } };
    },
  },
  {
    name: "payFees",
    description:
      "Démarre le parcours de paiement Mobile Money sécurisé d'AvadaSchool pour un élève. " +
      "N'effectue aucun débit : le parent poursuit dans le parcours guidé.",
    requiresAuth: true,
    parameters: {
      type: "object",
      properties: { studentId: { type: "string", description: "UUID de l'élève à payer (facultatif)." } },
      additionalProperties: false,
    },
    async run(args, ctx) {
      if (!token(ctx)) return AUTH_REQUIRED;
      const studentId = typeof args.studentId === "string" ? args.studentId : undefined;
      await startPaymentFlow(ctx.phone, studentId);
      return {
        ok: true,
        data: { started: true, note: "Le parcours de paiement guidé a été envoyé au parent." },
        openMenu: MENU_IDS.PAYMENT,
      };
    },
  },
  {
    name: "resetPassword",
    description:
      "Envoie un e-mail de réinitialisation de mot de passe via le service d'authentification AvadaSchool.",
    requiresAuth: false,
    parameters: {
      type: "object",
      properties: { email: { type: "string", description: "E-mail du compte parent." } },
      additionalProperties: false,
    },
    async run(args, ctx) {
      const email = (typeof args.email === "string" ? args.email : ctx.email)?.trim().toLowerCase();
      if (!email) return { ok: false, error: "E-mail manquant : demandez l'adresse du compte." };
      const res = await callBusinessFunction("auth", {
        method: "POST",
        path: "/forgot-password",
        body: { email },
      });
      if (!res.ok) return { ok: false, error: res.error ?? "Envoi impossible pour le moment." };
      return { ok: true, data: { sent: true, email } };
    },
  },
  {
    name: "getSupportInfo",
    description: "Retourne les coordonnées officielles du support AvadaSchool.",
    requiresAuth: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    run: () =>
      Promise.resolve({
        ok: true,
        data: { email: "Office.drc@avadapay.com", phone: "+243 812 163 851" },
        openMenu: MENU_IDS.HELP,
      }),
  },
];

export function toolDefinitions(ctx: AssistantContext): ChatToolDefinition[] {
  return TOOLS.filter((t) => !t.requiresAuth || ctx.authenticated).map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AssistantContext,
): Promise<ToolResult> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { ok: false, error: `Outil inconnu: ${name}` };
  if (tool.requiresAuth && !ctx.authenticated) return AUTH_REQUIRED;
  try {
    return await tool.run(args, ctx);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}