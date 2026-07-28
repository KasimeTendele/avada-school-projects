/** User-facing copy — centralised for easy translation. */
export const MESSAGES = {
  WELCOME: (name?: string) =>
    `Bonjour ${name ?? ""} 👋\nBienvenue sur AvadaSchool. Comment puis-je vous aider ?`.trim(),
  UNKNOWN_COMMAND:
    "Je n'ai pas compris votre message. Tapez *menu* pour afficher les options.",
  MENU_TITLE: "Menu principal",
  MENU_BUTTON: "Choisir",
  FEES_COMING_SOON: "🧾 La consultation des frais sera disponible très bientôt.",
  PAYMENT_COMING_SOON: "💳 Le paiement via WhatsApp sera disponible très bientôt.",
  HISTORY_COMING_SOON: "📜 L'historique des paiements sera disponible très bientôt.",
  HELP:
    "📞 Besoin d'aide ?\nContactez-nous à Office.drc@avadapay.com ou au +243 812 163 851.",
  CANCELLED: "Action annulée. Tapez *menu* pour recommencer.",
  BACK_TO_MENU: "Retour au menu principal.",
  INTERNAL_ERROR:
    "Une erreur est survenue. Merci de réessayer dans quelques instants.",
};