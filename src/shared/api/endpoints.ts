// Catalogue centralisé des chemins d'API.
// Toute modification d'URL backend ne doit toucher QUE ce fichier côté front.
export const endpoints = {
  auth: {
    login:          "/auth/login",
    register:       "/auth/register",
    forgotPassword: "/auth/forgot-password",
    resetPassword:  "/auth/reset-password",
    refresh:        "/auth/refresh",
    changePassword: "/auth/change-password",
  },
  users: {
    me: "/users-me",
  },
  schools: {
    base: "/admin-schools",
    byId: (id: string) => `/admin-schools/${id}`,
  },
  parents: {
    base: "/admin-parents",
    byId: (id: string) => `/admin-parents/${id}`,
  },
  students: {
    base: "/students",
    byId: (id: string) => `/students/${id}`,
    byParent: "/students-by-parent",
  },
  classes: {
    base: "/classes",
  },
  sections: {
    base: "/sections",
  },
  fees: {
    base: "/fees",
    byParent: "/fees-by-parent",
  },
  collections: {
    base: "/admin-collections",
  },
  payments: {
    base: "/payments",
    callback: "/payments-callback",
  },
  receipts: {
    base: "/receipts",
    byId: (id: string) => `/receipts/${id}`,
  },
  notifications: {
    base: "/notifications",
  },
  dashboards: {
    admin:   "/admin-dashboard",
    cashier: "/cashier-dashboard",
  },
} as const;