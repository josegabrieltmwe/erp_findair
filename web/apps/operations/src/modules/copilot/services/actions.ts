/**
 * Materializes the UI actions emitted by the Copilot backend (`actions[]`, tool navigateTo).
 *
 * The backend sends `route` = a SPA route NAME from a closed list. We navigate with vue-router
 * (`router.push({ name, params, query })`), never by assigning the browser location and never with the
 * obsolete `path` / `destination` / `filters` fields of the old contract (they point to the old ERP and are ignored).
 * Unknown routes, missing/invalid ids and unexpected query keys are dropped: the LLM cannot drive
 * arbitrary navigation.
 */
import type { RouteLocationRaw } from "vue-router";
import type { CopilotAction } from "../types";

export type CopilotRouteName =
  | "shipment-list"
  | "cargo-list"
  | "shipment-detail"
  | "cargo-detail"
  | "tracking"
  | "shipment-new"
  | "cargo-new";

/** What each allowed name accepts. The names must exist in src/router/index.ts (checked by the spec). */
const ROUTES: Record<
  CopilotRouteName,
  { needsId: boolean; acceptsFilters: boolean }
> = {
  "shipment-list": { needsId: false, acceptsFilters: true },
  "cargo-list": { needsId: false, acceptsFilters: true },
  "shipment-detail": { needsId: true, acceptsFilters: false },
  "cargo-detail": { needsId: true, acceptsFilters: false },
  tracking: { needsId: false, acceptsFilters: false },
  "shipment-new": { needsId: false, acceptsFilters: false },
  "cargo-new": { needsId: false, acceptsFilters: false },
};

export const COPILOT_ROUTE_NAMES = Object.keys(ROUTES) as CopilotRouteName[];

/**
 * Filters the list pages read from the URL (parseShipmentListQuery / parseCargoListQuery).
 * `period` is translated to date_from/date_to. `status` is NOT forwarded: neither list reads it from the URL.
 */
const PERIODS = ["today", "yesterday", "this_week", "this_month"] as const;
type Period = (typeof PERIODS)[number];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local-date range of a period. Weeks start on Monday. */
export function periodRange(
  period: Period,
  now: Date,
): { date_from: string; date_to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "today":
      return { date_from: ymd(today), date_to: ymd(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { date_from: ymd(y), date_to: ymd(y) };
    }
    case "this_week": {
      const monday = new Date(today);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      return { date_from: ymd(monday), date_to: ymd(today) };
    }
    case "this_month":
      return {
        date_from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)),
        date_to: ymd(today),
      };
  }
}

function isRealDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

function positiveInt(v: unknown): number | null {
  const n = typeof v === "string" && /^\d{1,12}$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : null;
}

function record(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/** Pure mapping action -> router location. null = not allowed / malformed. */
export function resolveAction(
  action: CopilotAction,
  now: Date = new Date(),
): RouteLocationRaw | null {
  if (action.type !== "navigate") return null;
  const name = action.route;
  if (
    typeof name !== "string" ||
    !Object.prototype.hasOwnProperty.call(ROUTES, name)
  )
    return null;
  const spec = ROUTES[name as CopilotRouteName];

  if (spec.needsId) {
    const id = positiveInt(record(action.params).id ?? action.id);
    if (id === null) return null;
    return { name, params: { id: String(id) } };
  }
  if (!spec.acceptsFilters) return { name };

  const src = record(action.query);
  const query: Record<string, string> = {};
  if (
    typeof src.period === "string" &&
    (PERIODS as readonly string[]).includes(src.period)
  ) {
    Object.assign(query, periodRange(src.period as Period, now));
  }
  // Explicit dates win over the period.
  if (isRealDate(src.date_from)) query.date_from = src.date_from;
  if (isRealDate(src.date_to)) query.date_to = src.date_to;
  const client = positiveInt(src.id_cliente);
  if (client !== null) query.id_cliente = String(client);

  return Object.keys(query).length ? { name, query } : { name };
}

/** Subset of vue-router's Router that runActions needs (eases testing). */
export interface ActionRouter {
  push(to: RouteLocationRaw): Promise<unknown> | unknown;
  hasRoute(name: string): boolean;
}

export interface RunActionsOptions {
  /** Delay so the user sees the assistant's message first (0 = immediate). */
  delayMs?: number;
  now?: Date;
}

/**
 * Run the FIRST navigate action that resolves (several navigations make no sense). Returns the location
 * used, or null when nothing was allowed. The route name must also exist in the live router.
 */
export function runActions(
  actions: CopilotAction[],
  router: ActionRouter,
  options: RunActionsOptions = {},
): RouteLocationRaw | null {
  for (const action of actions) {
    const to = resolveAction(action, options.now);
    if (to === null) continue;
    const name = (to as { name?: string }).name;
    if (typeof name !== "string" || !router.hasRoute(name)) continue;
    const go = (): void => {
      void Promise.resolve(router.push(to)).catch(() => undefined);
    };
    const delay = options.delayMs ?? 600;
    if (delay > 0) {
      setTimeout(go, delay);
    } else {
      go();
    }
    return to;
  }
  return null;
}
