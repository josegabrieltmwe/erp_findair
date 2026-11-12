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
  /** Hay contador pero la lista de destino no aplica este filtro: se dice en la descripción. */
  listApproximate?: boolean;
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
    listApproximate: true,
    link: { page: "pickup-list", query: {} },
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
    key: "giac_dacom",
    group: "assistance",
    icon: "mdi-package-variant-closed-plus",
    variant: "default",
    source: "special",
    scopes: ["inventory:read"],
    listApproximate: true,
    link: { page: "giacenze", query: { indicator: "open_giacenze" } },
  },
  {
    key: "giac_forn",
    group: "assistance",
    icon: "mdi-message-reply-text-outline",
    variant: "default",
    source: "special",
    scopes: ["inventory:read"],
    listApproximate: true,
    link: { page: "giacenze", query: { indicator: "open_giacenze" } },
  },
  {
    key: "giac15",
    group: "assistance",
    icon: "mdi-package-variant-closed-alert",
    variant: "error",
    source: "special",
    scopes: ["inventory:read"],
    link: { page: "giacenze", query: { indicator: "giacenze_overdue_15" } },
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
    listApproximate: true,
    link: { page: "crm-list", query: {} },
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
    key: "incassare",
    group: "admin",
    icon: "mdi-cash-clock",
    variant: "error",
    source: "special",
    scopes: ["payments:read"],
    listApproximate: true,
    link: { page: "payments", query: {} },
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

/** Cuenta los clientes distintos con saldo vencido > 0 (misma regla que el gestionale). */
export function countOverdueCustomers(
  rows: ReadonlyArray<{
    id_anagrafica?: number | string;
    importo?: number | string;
    scadenza?: string;
    data_close?: string | null;
    tipo?: string;
  }>,
  today: string,
): number {
  const byCustomer = new Map<string, number>();
  for (const r of rows) {
    if (r.tipo && r.tipo !== "A") continue;
    if (r.data_close && !/^0000-00-00/.test(String(r.data_close))) continue;
    const due = String(r.scadenza ?? "").slice(0, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(due) ||
      due.startsWith("0000") ||
      due >= today
    )
      continue;
    const key = String(r.id_anagrafica ?? "");
    byCustomer.set(key, (byCustomer.get(key) ?? 0) + (Number(r.importo) || 0));
  }
  return [...byCustomer.values()].filter((v) => v > 0).length;
}

export interface GiacenzaRowLike {
  data_open?: string | null;
  data_close?: string | null;
  cont_cliente_data?: string | null;
  cont_fornitore_data?: string | null;
  risp_cliente_data?: string | null;
}

const isDate = (v: unknown): v is string =>
  typeof v === "string" && v !== "" && !v.startsWith("0000-00-00");

/**
 * Los tres contadores de giacenze desde las mismas filas abiertas:
 *  - `giac_dacom`: abiertas y el cliente aún no fue avisado.
 *  - `giac_forn`: el cliente respondió y el proveedor no recibió las instrucciones después.
 *  - `giac15`: abiertas hace más de 15 días (días desde la apertura, no `giacenza_gg`, que son los días a cobrar).
 */
export function countGiacenze(
  rows: readonly GiacenzaRowLike[],
  now: number = Date.now(),
): Record<"giac_dacom" | "giac_forn" | "giac15", number> {
  let dacom = 0;
  let forn = 0;
  let over15 = 0;
  for (const g of rows) {
    if (isDate(g.data_close)) continue;
    if (!isDate(g.cont_cliente_data)) dacom += 1;
    if (
      isDate(g.risp_cliente_data) &&
      (!isDate(g.cont_fornitore_data) ||
        g.cont_fornitore_data < g.risp_cliente_data)
    )
      forn += 1;
    const opened = isDate(g.data_open)
      ? Date.parse(g.data_open.replace(" ", "T"))
      : NaN;
    if (!Number.isNaN(opened) && now - opened > 15 * 864e5) over15 += 1;
  }
  return { giac_dacom: dacom, giac_forn: forn, giac15: over15 };
}
