import type { LocationQuery, RouteLocationNormalized, RouteLocationRaw } from "vue-router";

/**
 * Traduce las URL del ERP antiguo a las rutas actuales de la SPA. Siguen vivas en marcadores, correos y notificaciones ya
 * guardadas; sin esto caerían en la ruta comodín y acabarían en la home sin avisar.
 *
 * Formas que llegan:
 *   /erp/tmwe_json/ops/cargo/5                → /cargo/5
 *   /erp/tmwe_json/operations#/giacenze?id=7  → /giacenze?id=7  (hash history anterior)
 *   /erp/tmwe_json/crm_pratica#/pratiche/9    → /crm/pratiche/9
 *   /erp/tmwe_json/cod_assegni                → /cod
 */
const PREFIX = /^\/(?:erp\/tmwe_json\/(?:ops\/)?|erp\/tmwe_json$|ops\/?)/;

/** Páginas antiguas cuyo nombre no coincide con la ruta actual. */
const RENAMED: Readonly<Record<string, string>> = {
  crm_pratica: "/crm",
  cod_assegni: "/cod",
  pickup_manager: "/pickup",
  admin_tracking: "/tracking",
  "invoicing/list": "/invoicing",
};

type LegacyLocation = Pick<RouteLocationNormalized, "path" | "query" | "hash">;

function crmPath(hashPath: string): string {
  const detail = /^\/pratiche\/(\d+)/.exec(hashPath);
  return detail ? `/crm/pratiche/${detail[1]}` : "/crm";
}

export function resolveLegacyUrl(to: LegacyLocation): RouteLocationRaw {
  const page = to.path.replace(PREFIX, "").replace(/\/+$/, "");
  const [hashPath, hashQuery = ""] = to.hash.replace(/^#/, "").split("?");
  const query: LocationQuery = { ...to.query, ...Object.fromEntries(new URLSearchParams(hashQuery)) };

  let path: string;
  if (page === "operations" && hashPath.startsWith("/")) {
    path = hashPath;
  } else if (page === "crm_pratica") {
    path = crmPath(hashPath);
  } else {
    path = RENAMED[page] ?? `/${page}`;
  }

  return { path, query, hash: "" };
}
