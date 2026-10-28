/** Rutas de humo: se montan sin parámetros. Fuente: web/apps/operations/src/router/index.ts */
export const SMOKE_ROUTES: { id: string; path: string; admin?: boolean }[] = [
  { id: "home", path: "/home" },
  { id: "cargo", path: "/cargo/list" },
  { id: "shipment", path: "/shipment/list" },
  { id: "tracking", path: "/tracking" },
  { id: "giacenze", path: "/giacenze" },
  { id: "consolidata", path: "/consolidata" },
  { id: "pickup", path: "/pickup/list" },
  { id: "crm", path: "/crm" },
  { id: "tickets", path: "/tickets" },
  { id: "bulk", path: "/bulk" },
  { id: "anagrafiche", path: "/settings/anagrafiche", admin: true },
  { id: "users", path: "/settings/users", admin: true },
  { id: "oauth-clients", path: "/settings/oauth-clients", admin: true },
  { id: "oauth-roles", path: "/settings/oauth-roles", admin: true },
  { id: "smtp", path: "/settings/smtp" },
  { id: "currencies", path: "/settings/currencies", admin: true },
];
