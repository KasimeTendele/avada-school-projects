/** Static labels, menu IDs and copy used across the WhatsApp modules. */

export const SESSION_TTL_MINUTES = 30;
export const MAX_LOGIN_ATTEMPTS = 5;

export const MENU_IDS = {
  HOME: "home",
  FEES: "fees",
  PAYMENT: "payment",
  HISTORY: "history",
  PASSWORD: "password",
  HELP: "help",
  LOGOUT: "logout",
} as const;

export type MenuId = (typeof MENU_IDS)[keyof typeof MENU_IDS];

export const ACTIONS = {
  BACK: "back",
  CANCEL: "cancel",
  HOME: "home",
  PAY_NOW: "pay_now",
  CONFIRM: "confirm",
  ABORT: "abort",
} as const;

export const HOME_MENU_ITEMS = [
  { id: MENU_IDS.FEES,     title: "📚 Frais de mes enfants",  description: "Consulter les frais dus" },
  { id: MENU_IDS.PAYMENT,  title: "💳 Payer les frais",        description: "Effectuer un paiement" },
  { id: MENU_IDS.HISTORY,  title: "📄 Historique",             description: "Voir mes paiements" },
  { id: MENU_IDS.PASSWORD, title: "🔑 Modifier mot de passe",  description: "Changer votre mot de passe" },
  { id: MENU_IDS.HELP,     title: "💬 Assistance",             description: "Obtenir de l'aide" },
  { id: MENU_IDS.LOGOUT,   title: "🚪 Déconnexion",            description: "Fermer la session" },
];