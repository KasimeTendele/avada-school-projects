/**
 * Static labels, menu IDs and copy used across the WhatsApp modules.
 */

export const SESSION_TTL_MINUTES = 30;

export const MENU_IDS = {
  HOME: "home",
  FEES: "fees",
  PAYMENT: "payment",
  HISTORY: "history",
  HELP: "help",
} as const;

export type MenuId = (typeof MENU_IDS)[keyof typeof MENU_IDS];

export const ACTIONS = {
  BACK: "back",
  CANCEL: "cancel",
  HOME: "home",
} as const;

export const HOME_MENU_ITEMS = [
  { id: MENU_IDS.FEES, title: "Frais scolaires", description: "Consulter les frais dus" },
  { id: MENU_IDS.PAYMENT, title: "Payer", description: "Effectuer un paiement" },
  { id: MENU_IDS.HISTORY, title: "Historique", description: "Voir mes paiements" },
  { id: MENU_IDS.HELP, title: "Aide", description: "Obtenir de l'aide" },
];