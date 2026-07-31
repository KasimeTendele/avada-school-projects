/**
 * Mise en forme des réponses pour WhatsApp. Aucun appel réseau ici.
 */
const MAX_LEN = 3800; // Limite Meta : 4096 caractères pour un message texte.

/** Nettoie le Markdown non supporté par WhatsApp et borne la longueur. */
export function formatForWhatsApp(text: string): string {
  const cleaned = text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "*$1*")
    .replace(/`{3}[a-z]*\n?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned.length > MAX_LEN ? `${cleaned.slice(0, MAX_LEN - 1)}…` : cleaned;
}

/** Résultat d'outil sérialisé pour le modèle (compact, jamais de secret). */
export function formatToolResult(result: { ok: boolean; data?: unknown; error?: string }): string {
  return JSON.stringify(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error });
}

export const FALLBACK_REPLY =
  "Je n'ai pas pu traiter votre demande pour le moment. Tapez *menu* pour utiliser le menu AvadaSchool.";