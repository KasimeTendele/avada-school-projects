/** User-facing copy — centralised for easy translation. */
export const MESSAGES = {
  // Onboarding / auth
  AUTH_WELCOME:
    "👋 Bienvenue sur *AvadaSchool*.\n\nPour accéder à votre espace parent, veuillez vous connecter.\n\n📧 Veuillez saisir votre *adresse e-mail*.",
  AUTH_ASK_EMAIL: "📧 Veuillez saisir votre *adresse e-mail*.",
  AUTH_INVALID_EMAIL:
    "❌ Adresse e-mail invalide. Veuillez saisir une adresse valide (ex. parent@exemple.com).",
  AUTH_ASK_PASSWORD: "🔒 Veuillez maintenant saisir votre *mot de passe*.",
  AUTH_FAILED_RETRY: (remaining: number) =>
    `❌ Adresse e-mail ou mot de passe incorrect.\nIl vous reste *${remaining}* tentative(s).\n\n📧 Veuillez saisir à nouveau votre adresse e-mail.`,
  AUTH_FAILED_LOCKED:
    "🚫 Trop de tentatives échouées. Réessayez dans quelques minutes en tapant *menu*.",
  AUTH_SUCCESS: (firstName: string) =>
    `✅ Bonjour *${firstName}*,\nBienvenue sur AvadaSchool.\n\nQue souhaitez-vous faire ?`,
  SESSION_EXPIRED:
    "⌛ Votre session a expiré. Veuillez vous reconnecter.\n\n📧 Adresse e-mail :",

  // Menu
  MENU_TITLE: "Menu principal",
  MENU_BUTTON: "Choisir",
  UNKNOWN_COMMAND:
    "Je n'ai pas compris votre message. Tapez *menu* pour afficher les options.",

  // Fees
  FEES_NO_CHILDREN: "ℹ️ Aucun enfant n'est lié à votre compte pour l'instant.",
  FEES_NO_DUE: (name: string) =>
    `✅ Aucun frais impayé pour *${name}* pour le moment.`,
  FEES_SELECT_CHILD: "Sélectionnez un enfant :",
  FEES_LIST_TITLE: "Enfants",
  FEES_LIST_BUTTON: "Choisir",

  // Payment
  PAY_SELECT_FEE: "Sélectionnez le frais à payer :",
  PAY_SELECT_METHOD: "Choisissez le moyen de paiement :",
  PAY_ASK_PHONE:
    "📱 Entrez le *numéro Mobile Money* (10 chiffres, ex. 0812345678) :",
  PAY_INVALID_PHONE:
    "❌ Numéro invalide. Entrez 9 ou 10 chiffres (opérateur reconnu automatiquement).",
  PAY_INITIATED: (ref: string) =>
    `⏳ Paiement initié. Vous allez recevoir une invite sur votre téléphone pour valider.\nRéférence : *${ref}*.\n\nJe vous confirme dès la validation.`,
  PAY_SUCCESS: (info: { amount: string; currency: string; ref: string; date: string }) =>
    `✅ *Paiement effectué avec succès.*\n\n💰 Montant : *${info.amount} ${info.currency}*\n🔖 Référence : *${info.ref}*\n📅 Date : ${info.date}\n\n📎 Votre reçu PDF est en cours d'envoi…`,
  PAY_FAILED:
    "❌ Le paiement a échoué ou a été annulé. Vous pouvez réessayer depuis le menu principal.",
  PAY_PENDING_TIMEOUT:
    "⏳ Nous n'avons pas encore reçu de confirmation de votre opérateur. Vous recevrez une notification dès la validation.",

  // History
  HISTORY_EMPTY: "ℹ️ Aucun paiement n'a encore été enregistré.",
  HISTORY_HEADER: "📄 *Vos 10 derniers paiements* :",

  // Password change
  PWD_ASK_CURRENT: "🔐 Entrez votre *mot de passe actuel* :",
  PWD_ASK_NEW: "🆕 Entrez votre *nouveau mot de passe* (8 caractères minimum) :",
  PWD_ASK_CONFIRM: "🔁 Confirmez votre *nouveau mot de passe* :",
  PWD_MISMATCH: "❌ Les deux mots de passe ne correspondent pas. Recommençons.\n\n" +
    "🆕 Entrez votre nouveau mot de passe :",
  PWD_TOO_SHORT: "❌ Le mot de passe doit contenir au moins 8 caractères.",
  PWD_WRONG_CURRENT: "❌ Mot de passe actuel incorrect. Retour au menu.",
  PWD_UPDATED: "✅ Mot de passe mis à jour avec succès.",

  // Logout / help
  LOGOUT_DONE: "👋 Vous êtes déconnecté(e). Tapez *menu* pour revenir.",
  HELP:
    "📞 Besoin d'aide ?\nContactez-nous à Office.drc@avadapay.com ou au +243 812 163 851.",
  CANCELLED: "Action annulée. Tapez *menu* pour recommencer.",
  BACK_TO_MENU: "Retour au menu principal.",
  INTERNAL_ERROR:
    "Une erreur est survenue. Merci de réessayer dans quelques instants.",
};