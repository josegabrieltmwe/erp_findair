/**
 * Resolución centralizada de URLs de navegación entre módulos del ERP.
 *
 * PROBLEMA que resuelve: los enlaces cross-app (PlatformSidebar, PlatformTopBar,
 * HomePage…) están hardcoded a las URLs de las apps VIEJAS
 * (`/cargo/list`…). Al consolidar en la SPA `operations`, esas
 * URLs deben cambiar a rutas internas (`/cargo/list`).
 * Reescribir 63 archivos sería frágil; en su lugar TODOS leen de aquí.
 *
 * FLAG DE CUTOVER: `isConsolidated()` decide qué URL devolver. Hoy es `false`
 * (apps viejas). El día del cutover se pone `true` (una línea / un global) y
 * todos los enlaces apuntan a operations, sin tocar cada archivo.
 *
 * Estado: infraestructura LISTA pero DESACTIVADA (flag=false). Ver
 * docs/consolidacion-conflictos-redireccion.md.
 */

declare global {
  interface Window {
    /** Flag de cutover: true → la navegación apunta a la SPA `operations`. */
    __TMWE_CONSOLIDATED__?: boolean;
  }
}

/** Módulos operativos que viven (o vivirán) dentro de la SPA `operations`. */
export type NavModule =
  | "home"
  | "cargo"
  | "shipment"
  | "clients"
  | "invoicing"
  | "cod_assegni"
  | "giacenze"
  | "pickup"
  | "crm"
  | "proforma"
  | "bulk"
  | "copilot"
  | "tracking";

/**
 * ¿Está activo el modo consolidado? Hoy `false` (apps viejas). El cutover lo
 * activará vía un global inyectado por el template PHP
 * (`window.__TMWE_CONSOLIDATED__ = true`) o cambiando el default aquí.
 */
export function isConsolidated(): boolean {
  if (typeof window !== "undefined" && window.__TMWE_CONSOLIDATED__ === true) {
    return true;
  }
  return false; // DEFAULT: apps viejas (pre-cutover)
}

const BASE = "";

/** URL de la app VIEJA por módulo (una página por dominio). */
const LEGACY_HREF: Record<NavModule, string> = {
  home: `${BASE}/home`,
  cargo: `${BASE}/cargo/list`,
  shipment: `${BASE}/shipment/list`,
  clients: `${BASE}/clients`,
  invoicing: `${BASE}/invoicing/list`,
  cod_assegni: `${BASE}/cod_assegni`,
  giacenze: `${BASE}/giacenze`,
  pickup: `${BASE}/pickup_manager`,
  crm: `${BASE}/crm_pratica`,
  proforma: `${BASE}/proforma`,
  bulk: `${BASE}/bulk`,
  copilot: `${BASE}/copilot`,
  tracking: `${BASE}/admin_tracking`,
};

/**
 * Ruta interna de cada módulo dentro de la SPA `operations`.
 *
 * Sin `#`: la SPA usa history mode bajo el prefijo `/ops/`, así que estas son
 * rutas reales del servidor. El `.htaccess` manda cualquier profundidad bajo
 * `/ops/` a la SPA y el router resuelve el resto en cliente.
 */
const OPERATIONS_PATH: Record<NavModule, string> = {
  home: "/home",
  cargo: "/cargo/list",
  shipment: "/shipment/list",
  clients: "/clients",
  invoicing: "/invoicing",
  cod_assegni: "/cod",
  giacenze: "/giacenze",
  pickup: "/pickup",
  crm: "/crm",
  proforma: "/proforma",
  bulk: "/bulk",
  copilot: "/copilot",
  tracking: "/tracking",
};

/** Prefijo de la SPA unificada. Debe coincidir con el `base` del router. */
const OPS = "/ops";

/**
 * URL destino de un módulo, según el flag de cutover.
 * - pre-cutover: la app vieja (`/cargo/list`…).
 * - post-cutover: la SPA operations (`/ops/cargo/list`…).
 */
export function moduleHref(mod: NavModule): string {
  if (isConsolidated()) {
    return `${BASE}${OPS}${OPERATIONS_PATH[mod]}`;
  }
  return LEGACY_HREF[mod];
}

/**
 * URL de detalle de una expedición (cargo o shipment) por id, según el flag.
 * - consolidado: `/ops/cargo/:id` — ruta limpia de la SPA unificada.
 * - pre-cutover: `/cargo/:id` — la app vieja.
 * Usar para "abrir en nueva pestaña" o enlaces cross-módulo, ya que la URL
 * vieja `/cargo/:id` redirige al listado cuando el cutover está activo.
 */
export function detailHref(
  kind: "cargo" | "shipment",
  id: string | number | null | undefined,
  query = "",
): string {
  const idPart = encodeURIComponent(String(id ?? ""));
  const qs = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  if (isConsolidated()) {
    return `${BASE}${OPS}/${kind}/${idPart}${qs}`;
  }
  return `${BASE}/${kind}/${idPart}${qs}`;
}

/**
 * URL de creación (página "new") de una expedición, según el flag.
 * - consolidado: `/ops/cargo/new` — ruta limpia de la SPA.
 * - pre-cutover: `/cargo/new` — la app vieja.
 * La URL vieja `/cargo/new` redirige al listado bajo el cutover, así que los
 * CTA "nueva expedición" deben usar esto.
 */
export function newHref(kind: "cargo" | "shipment"): string {
  if (isConsolidated()) {
    return `${BASE}${OPS}/${kind}/new`;
  }
  return `${BASE}/${kind}/new`;
}

/**
 * Destino de router (ruta interna) para un href de app VIEJA, o `null` si el
 * href no corresponde a un módulo migrado (→ el llamador debe navegar por URL
 * completa / recarga).
 *
 * Resuelve el href a `{ name, query }` para `router.push`, PRESERVANDO el query
 * string (`?new=1`, `?tipo=P`…) que el interceptor de <a> del shell perdía. Se
 * usa donde una navegación por recarga (`window.location.href = legacyUrl`)
 * ahora rompe bajo el cutover (la URL vieja redirige al listado o 404 en paths
 * profundos como `/invoicing/list?new=1`).
 *
 * Devuelve solo cuando el cutover está activo; pre-cutover retorna `null` para
 * que el enlace siga navegando a la app vieja como siempre.
 */
export interface SpaTarget {
  name: string;
  query: Record<string, string>;
}

const HREF_TO_ROUTE: Array<{ match: RegExp; name: string }> = [
  // `home2` (demostrador SwiftPack) retirado. Su patrón iba ANTES que el de
  // `home` porque /home\b no casa /home2; al quitarlo, un href antiguo a
  // /tmwe_json/home2 deja de resolverse a ruta SPA y recarga contra el
  // servidor, que lo redirige 301 a /ops/home. No se remapea a `home` aquí
  // a propósito: mejor una recarga correcta que aterrizar callado en otra
  // pantalla distinta de la que pedía el enlace.
  { match: /\/tmwe_json\/home\b/, name: "home" },
  { match: /\/tmwe_json\/cargo\/new\b/, name: "cargo-new" },
  { match: /\/tmwe_json\/cargo\/list\b/, name: "cargo-list" },
  { match: /\/tmwe_json\/cargo\b/, name: "cargo" },
  { match: /\/tmwe_json\/shipment\/new\b/, name: "shipment-new" },
  { match: /\/tmwe_json\/shipment\/list\b/, name: "shipment-list" },
  { match: /\/tmwe_json\/shipment\b/, name: "shipment" },
  // El nombre de ruta es `anagrafiche`, no `clients` (el path publico si es
  // /clients). Ver OperationsNav.vue: los nombres son el contrato de
  // @shared/anagrafiche y operations los alineo con partner_clients/admin_config.
  { match: /\/tmwe_json\/clients\b/, name: "anagrafiche" },
  { match: /\/tmwe_json\/invoicing\b/, name: "invoicing" },
  { match: /\/tmwe_json\/cod_assegni\b/, name: "cod" },
  { match: /\/tmwe_json\/giacenze\b/, name: "giacenze" },
  { match: /\/tmwe_json\/pickup_manager\b/, name: "pickup" },
  { match: /\/tmwe_json\/proforma\b/, name: "proforma" },
  { match: /\/tmwe_json\/crm\b/, name: "crm" },
  { match: /\/tmwe_json\/bulk\b/, name: "bulk" },
  { match: /\/tmwe_json\/copilot\b/, name: "copilot" },
  { match: /\/tmwe_json\/admin_tracking\b/, name: "tracking" },
];

export function resolveSpaTarget(href: string): SpaTarget | null {
  if (!isConsolidated()) return null;
  if (!href || href.indexOf("/tmwe_json/") === -1) return null;
  // Un href que YA apunta a la SPA lo resuelve el router por su cuenta. Cubre
  // las dos formas: `/ops/...` (history mode, la actual) y `/operations#...`
  // (hash, la anterior) — los enlaces guardados en marcadores o correos siguen
  // circulando y no deben reinterpretarse aquí.
  if (href.indexOf("/ops/") !== -1 || href.indexOf("/operations#") !== -1) {
    return null;
  }
  const hit = HREF_TO_ROUTE.find((m) => m.match.test(href));
  if (!hit) return null;
  // Extrae el query string (?a=1&b=2) del href legacy, si lo hubiera.
  const query: Record<string, string> = {};
  const qIdx = href.indexOf("?");
  if (qIdx !== -1) {
    const raw = href.slice(qIdx + 1).split("#")[0];
    for (const pair of raw.split("&")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      const k = eq === -1 ? pair : pair.slice(0, eq);
      const v = eq === -1 ? "" : pair.slice(eq + 1);
      query[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  return { name: hit.name, query };
}
