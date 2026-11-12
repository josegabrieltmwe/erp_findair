/**
 * «Da fare oggi» — la franja de la home con lo que espera una acción del operador.
 *
 * Es el equivalente del primer bloque de la home de Jose_master: tarjetas curadas
 * y transversales (express, cargo, recogidas, asistencia, mensajes, administración),
 * cada una con su número y su enlace a la lista ya filtrada. Las del catálogo de KPI
 * (`home_kpi_catalog.ts`) reutilizan su fuente de datos; las que no tienen KPI
 * propio (`source: 'special'`) las resuelve `today_special.service.ts`.
 *
 * Este fichero es lógica pura (sin Vue ni red) para poder probarla.
 */
import { HOME_KPI_CATALOG, type KpiCategory } from "./home_kpi_catalog";

export type TodayGroupId =
  | "express"
  | "cargo"
  | "pickups"
  | "assistance"
  | "messages"
  | "admin";

export type TodayVariant = "default" | "success" | "warning" | "error";

/** Rutas a las que puede llevar una tarjeta (nombres del router de operations). */
export type TodayRoute =
  | "shipment-list"
  | "cargo-list"
  | "pickup-list"
  | "giacenze"
  | "crm-list"
  | "payments"
  | "invoicing-list";

export interface TodayTile {
  /** Clave del contador; para `catalog` coincide con la del catálogo de KPI. */
  key: string;
  group: TodayGroupId;
  icon: string;
  variant: TodayVariant;
  /**
   * `catalog`: el número sale de la fuente del cockpit (courier / cargo / indicadores).
   * `special`: lo calcula `today_special.service.ts`.
   * `none`: tarjeta sin número (contarlo costaría una llamada pesada): lleva a la cola y basta.
   */
  source: "catalog" | "special" | "none";
  link: { page: TodayRoute; query: Record<string, string> };
  /** Scopes del token que dan acceso a la pantalla destino; sin ninguno de ellos la tarjeta no se muestra. */
  scopes?: readonly string[];
}

export const TODAY_GROUPS: readonly TodayGroupId[] = [
  "express",
  "cargo",
  "pickups",
  "assistance",
  "messages",
  "admin",
];

export const TODAY_TILES: readonly TodayTile[] = [
  // — Express —
  {
    key: "dacontr",
    group: "express",
    icon: "mdi-clipboard-check-outline",
    variant: "default",
    source: "catalog",
    link: { page: "shipment-list", query: { type: "dacontr" } },
  },
  {
    key: "dactrnote",
    group: "express",
    icon: "mdi-note-alert-outline",
    variant: "default",
    source: "catalog",
    link: { page: "shipment-list", query: { type: "dactrnote" } },
  },
  {
    key: "resi",
    group: "express",
    icon: "mdi-keyboard-return",
    variant: "default",
    source: "special",
    link: { page: "shipment-list", query: { consegna_stato: "5" } },
  },
  // — Cargo —
  {
    key: "toqt",
    group: "cargo",
    icon: "mdi-airplane-clock",
    variant: "default",
    source: "catalog",
    link: { page: "cargo-list", query: { type: "toqt" } },
  },
  {
    key: "toorg",
    group: "cargo",
    icon: "mdi-airplane-check",
    variant: "default",
    source: "catalog",
    link: { page: "cargo-list", query: { type: "toorg" } },
  },
  // — Recogidas —
  {
    key: "preseint",
    group: "pickups",
    icon: "mdi-package-up-outline",
    variant: "default",
    source: "catalog",
    link: { page: "shipment-list", query: { type: "preseint" } },
  },
  {
    key: "prese_daaff",
    group: "pickups",
    icon: "mdi-account-arrow-right-outline",
    variant: "default",
    source: "special",
    scopes: ["pickups:read"],
    link: { page: "pickup-list", query: { queue: "to_assign" } },
  },
  {
    key: "presefornN",
    group: "pickups",
    icon: "mdi-truck-plus-outline",
    variant: "default",
    source: "catalog",
    link: { page: "shipment-list", query: { type: "presefornN" } },
  },
  // — Asistencia —
  {
    key: "giac_to_notify_client",
    group: "assistance",
    icon: "mdi-package-variant-closed-plus",
    variant: "default",
    source: "catalog",
    scopes: ["inventory:read"],
    link: { page: "giacenze", query: { indicator: "giac_to_notify_client" } },
  },
  {
    key: "giac_to_instruct_supplier",
    group: "assistance",
    icon: "mdi-message-reply-text-outline",
    variant: "default",
    source: "catalog",
    scopes: ["inventory:read"],
    link: {
      page: "giacenze",
      query: { indicator: "giac_to_instruct_supplier" },
    },
  },
  {
    key: "giac_open_over_15_days",
    group: "assistance",
    icon: "mdi-package-variant-closed-alert",
    variant: "error",
    source: "catalog",
    scopes: ["inventory:read"],
    link: { page: "giacenze", query: { indicator: "giac_open_over_15_days" } },
  },
  {
    key: "open_cases",
    group: "assistance",
    icon: "mdi-lifebuoy",
    variant: "default",
    source: "catalog",
    link: { page: "crm-list", query: { indicator: "open_cases" } },
  },
  {
    key: "pratiche_lav",
    group: "assistance",
    icon: "mdi-progress-wrench",
    variant: "default",
    source: "special",
    link: { page: "crm-list", query: { stato_pratica: "L" } },
  },
  // — Mensajes —
  {
    key: "chat_express",
    group: "messages",
    icon: "mdi-chat-processing-outline",
    variant: "warning",
    source: "special",
    link: { page: "shipment-list", query: { chat_unread: "1" } },
  },
  {
    key: "chat_cargo",
    group: "messages",
    icon: "mdi-chat-processing-outline",
    variant: "warning",
    source: "special",
    link: { page: "cargo-list", query: { chat_unread: "1" } },
  },
  // — Administración —
  {
    key: "payments_overdue_customers",
    group: "admin",
    icon: "mdi-cash-clock",
    variant: "error",
    source: "catalog",
    scopes: ["payments:read"],
    link: { page: "payments", query: { statop: "SC" } },
  },
  {
    key: "dafatt",
    group: "admin",
    icon: "mdi-receipt-text-outline",
    variant: "default",
    source: "none",
    scopes: ["invoices:read"],
    link: { page: "invoicing-list", query: {} },
  },
];

/** Categoría del cockpit que alimenta una tarjeta `catalog` (undefined si la clave no está en el catálogo). */
export function tileCategory(tile: TodayTile): KpiCategory | undefined {
  if (tile.source !== "catalog") return undefined;
  return HOME_KPI_CATALOG.find((k) => k.key === tile.key)?.category;
}

/** Categorías del cockpit que hay que pedir para pintar las tarjetas `catalog`. */
export function todayCategories(
  tiles: readonly TodayTile[] = TODAY_TILES,
): KpiCategory[] {
  const out = new Set<KpiCategory>();
  for (const tile of tiles) {
    const c = tileCategory(tile);
    if (c) out.add(c);
  }
  return [...out];
}

/** Tarjetas visibles para unos scopes. `known=false` (perfil sin `access`) falla ABIERTO: el API autoriza igualmente. */
export function visibleTodayTiles(
  access: { scopes: readonly string[]; known: boolean; isRoot?: boolean },
  tiles: readonly TodayTile[] = TODAY_TILES,
): TodayTile[] {
  return tiles.filter((tile) => {
    if (!tile.scopes || tile.scopes.length === 0) return true;
    if (!access.known || access.isRoot) return true;
    return tile.scopes.some((s) => access.scopes.includes(s));
  });
}

export type TileState = "loading" | "ready" | "unavailable";

export interface TileResolution {
  state: TileState;
  /** Número a mostrar; con `unavailable` o `loading` puede ser el último valor bueno (`stale`). */
  value: number | null;
  /** El valor viene de la última carga buena guardada, no de la de ahora. */
  stale: boolean;
}

export interface ResolveContext {
  /** Contadores del cockpit (courier / cargo / indicadores). */
  counts: Readonly<Record<string, number>>;
  /** Categorías del cockpit aún en vuelo. */
  pending: ReadonlySet<string>;
  /** Categorías del cockpit que fallaron (clave = categoría). */
  errors: Readonly<Record<string, string>>;
  /** Contadores especiales: número, `null` si falló, ausente si aún no llegó. */
  special: Readonly<Record<string, number | null>>;
  /** Último valor bueno guardado de cada tarjeta. */
  cached: Readonly<Record<string, number>>;
}

/**
 * Qué enseña una tarjeta ahora mismo.
 *
 * Regla de Jose_master: un contador que no se pudo calcular es «n/d», nunca 0 (a cero la
 * tarjeta se ocultaría y parecería que no hay trabajo). Mientras llega el dato fresco se
 * enseña el último bueno si lo hay.
 */
export function resolveTile(
  tile: TodayTile,
  ctx: ResolveContext,
): TileResolution {
  const cached = ctx.cached[tile.key];
  const fallback = (state: TileState): TileResolution =>
    cached !== undefined
      ? {
          state: state === "unavailable" ? "unavailable" : "loading",
          value: cached,
          stale: true,
        }
      : { state, value: null, stale: false };

  if (tile.source === "none")
    return { state: "ready", value: null, stale: false };

  if (tile.source === "special") {
    const v = ctx.special[tile.key];
    if (typeof v === "number")
      return { state: "ready", value: v, stale: false };
    return fallback(v === null ? "unavailable" : "loading");
  }

  const category = tileCategory(tile);
  if (!category) return fallback("unavailable");
  const v = ctx.counts[tile.key];
  if (typeof v === "number") return { state: "ready", value: v, stale: false };
  if (ctx.errors[category] !== undefined && !ctx.pending.has(category))
    return fallback("unavailable");
  return fallback("loading");
}

/** Una tarjeta se oculta solo cuando está resuelta de verdad en 0. */
export function isZeroTile(tile: TodayTile, r: TileResolution): boolean {
  return (
    tile.source !== "none" && r.state === "ready" && !r.stale && r.value === 0
  );
}

export interface CountRequest {
  /** Ruta del BFF (se pide con GET). */
  path: string;
  query: Record<string, string>;
}

/** Una petición «de conteo»: el servidor devuelve el total y como mucho UNA fila (nunca una página de datos). */
export function isCountOnly(req: CountRequest): boolean {
  return (
    req.query.count_only === "1" ||
    req.query.per_page === "1" ||
    req.query.per_page === "0"
  );
}

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Peticiones de conteo de las tarjetas `special`. La home NO pide listados: cada una es el total
 * (`pagination.total`) del listado ya filtrado en el servidor, con `per_page=1` o `count_only=1`.
 * Las demás tarjetas con número salen de los indicadores del API (`api_home_box_indicators`).
 *
 *  - `prese_daaff`: la cola «Da assegnare» de la lista de ritiri (`queueFilters('to_assign')`).
 *  - `pratiche_lav`: pratiche en curso (estado L).
 */
export function countRequests(
  now: Date = new Date(),
): Record<string, CountRequest> {
  return {
    resi: {
      path: "/api_courier_shipments",
      query: { consegna_stato: "5", count_only: "1", per_page: "1" },
    },
    prese_daaff: {
      path: "/api_pickups_crud",
      query: { affidata: "N", data_da: ymd(now), per_page: "1" },
    },
    pratiche_lav: {
      path: "/api_crm_crud",
      query: { stato_pratica: "L", per_page: "1", limit: "1" },
    },
  };
}
