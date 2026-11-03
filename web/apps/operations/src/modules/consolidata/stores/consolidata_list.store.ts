/**
 * Listado de proyectos de consolidata (view=queue del endpoint
 * unified_consolidation_project). Mismo patrón que cargo_list.store.ts:
 * estado serializable en la URL (`parse*` / `serialize*` con los valores por
 * defecto fuera de la URL), `build*` hacia el API y un AbortController por
 * petición para que una búsqueda nueva cancele la anterior.
 *
 * Diferencias con cargo: el API responde {items, count, current_page,
 * max_page} (no {data, pagination}); el adaptador a ListSource lo hace
 * `toListSource`. Los recuentos por fase llegan en UNA llamada
 * (view=queue_counts) en vez de una por mosaico.
 */
import { defineStore } from "pinia";
import { ref } from "vue";
import type { ListSource } from "@shared/listing/types";
import {
  consolidataService,
  ConsolidataRequestError,
  type QueryParams,
} from "../services/consolidata.service";
import { normalizeApiError } from "../logic";
import type {
  ConsolidataError,
  ProjectPhase,
  QueueCounts,
  QueueItem,
  QueuePage,
} from "../types";

/** Orden admitido por el API (Consolidation_Queue_Query::SORTS). */
export const CONSOLIDATA_SORTS = [
  "id",
  "modif_datetime",
  "insert_datetime",
  "totale",
  "cliente",
  "stato",
  "risposta_valida_fino",
] as const;
export type ConsolidataSort = (typeof CONSOLIDATA_SORTS)[number];

export const QUALE_DATA = ["insert", "modif", "chiuso", "risposta"] as const;
export type QualeData = (typeof QUALE_DATA)[number];

const FASI: readonly string[] = [
  "abierto",
  "sin_asignar",
  "pendiente_respuesta",
  "respondido",
  "respuesta_vencida",
  "por_convertir",
  "convertido",
  "cancelado",
];

export interface ConsolidataListUrlState {
  page: number;
  per_page: number;
  sort: ConsolidataSort;
  dir: "asc" | "desc";
  q: string;
  /** Letra o lista separada por comas (A,P,C,X). "" = sin filtro de estado propio. */
  stato: string;
  /** Fase (mosaico KPI). "" = todos. */
  fase: string;
  tipo: string;
  hub_terminal: string;
  dest_country: string;
  orig_paese: string;
  id_partner: string;
  /** "" | "me" | "none" | id de usuario */
  assegnato_a: string;
  id_cliente: string;
  date_from: string;
  date_to: string;
  quale_data: QualeData;
  risposta: string;
  conversione: string;
  id_cargo: string;
  totale_min: string;
  totale_max: string;
  n_sped_min: string;
  n_sped_max: string;
}

export const CONSOLIDATA_LIST_DEFAULTS: ConsolidataListUrlState = {
  page: 1,
  per_page: 25,
  sort: "modif_datetime",
  dir: "desc",
  q: "",
  stato: "",
  fase: "",
  tipo: "",
  hub_terminal: "",
  dest_country: "",
  orig_paese: "",
  id_partner: "",
  assegnato_a: "",
  id_cliente: "",
  date_from: "",
  date_to: "",
  quale_data: "insert",
  risposta: "",
  conversione: "",
  id_cargo: "",
  totale_min: "",
  totale_max: "",
  n_sped_min: "",
  n_sped_max: "",
};

/** Filtros del cajón «avanzado» (los que cuentan en el contador del botón). */
export const CONSOLIDATA_ADVANCED_KEYS: ReadonlyArray<
  keyof ConsolidataListUrlState
> = [
  "stato",
  "id_partner",
  "orig_paese",
  "risposta",
  "conversione",
  "id_cargo",
  "totale_min",
  "totale_max",
  "n_sped_min",
  "n_sped_max",
];

/** Todos los filtros semánticos (sin paginación ni orden). */
export const CONSOLIDATA_FILTER_KEYS: ReadonlyArray<
  keyof ConsolidataListUrlState
> = [
  "q",
  "stato",
  "fase",
  "tipo",
  "hub_terminal",
  "dest_country",
  "orig_paese",
  "id_partner",
  "assegnato_a",
  "id_cliente",
  "date_from",
  "date_to",
  "risposta",
  "conversione",
  "id_cargo",
  "totale_min",
  "totale_max",
  "n_sped_min",
  "n_sped_max",
];

function str(v: unknown): string {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "string"
    ? x.trim()
    : typeof x === "number"
      ? String(x)
      : "";
}

function posInt(v: unknown, def: number, max?: number): number {
  const n = Number(str(v));
  if (!Number.isInteger(n) || n <= 0) return def;
  return max ? Math.min(n, max) : n;
}

function idStr(v: unknown): string {
  const s = str(v);
  return /^\d+$/.test(s) && Number(s) > 0 ? s : "";
}

function numStr(v: unknown): string {
  const s = str(v);
  return s !== "" && Number.isFinite(Number(s)) ? s : "";
}

function upper(v: unknown, re: RegExp): string {
  const s = str(v).toUpperCase();
  return re.test(s) ? s : "";
}

function oneOf(v: unknown, allowed: readonly string[]): string {
  const s = str(v).toLowerCase();
  return allowed.includes(s) ? s : "";
}

function statoList(v: unknown): string {
  const parts = str(v)
    .toUpperCase()
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const ok = parts.filter((p) => ["A", "P", "C", "X"].includes(p));
  return ok.length === parts.length ? Array.from(new Set(ok)).join(",") : "";
}

function assignee(v: unknown): string {
  const s = str(v);
  if (s === "me" || s === "none") return s;
  return idStr(s);
}

/** URL → estado. Claves desconocidas se ignoran; valores inválidos vuelven al defecto. */
export function parseConsolidataListQuery(
  q: Record<string, unknown>,
): ConsolidataListUrlState {
  const d = CONSOLIDATA_LIST_DEFAULTS;
  const sort = str(q.sort);
  const qd = str(q.quale_data);
  return {
    page: posInt(q.page, d.page),
    per_page: posInt(q.per_page, d.per_page, 100),
    sort: (CONSOLIDATA_SORTS as readonly string[]).includes(sort)
      ? (sort as ConsolidataSort)
      : d.sort,
    dir: str(q.dir).toLowerCase() === "asc" ? "asc" : "desc",
    q: str(q.q).slice(0, 100),
    stato: statoList(q.stato),
    fase: oneOf(q.fase, FASI),
    tipo: upper(q.tipo, /^(CONS|XTRADE|MULTI)$/),
    hub_terminal: upper(q.hub_terminal, /^[A-Z0-9]{3,5}$/),
    dest_country: upper(q.dest_country, /^[A-Z]{2}$/),
    orig_paese: upper(q.orig_paese, /^[A-Z]{2}$/),
    id_partner: idStr(q.id_partner),
    assegnato_a: assignee(q.assegnato_a),
    id_cliente: idStr(q.id_cliente),
    date_from: /^\d{4}-\d{2}-\d{2}$/.test(str(q.date_from))
      ? str(q.date_from)
      : "",
    date_to: /^\d{4}-\d{2}-\d{2}$/.test(str(q.date_to)) ? str(q.date_to) : "",
    quale_data: (QUALE_DATA as readonly string[]).includes(qd)
      ? (qd as QualeData)
      : d.quale_data,
    risposta: oneOf(q.risposta, ["no", "vigente", "vencida"]),
    conversione: oneOf(q.conversione, ["no", "parcial", "completo"]),
    id_cargo: idStr(q.id_cargo),
    totale_min: numStr(q.totale_min),
    totale_max: numStr(q.totale_max),
    n_sped_min: /^\d+$/.test(str(q.n_sped_min)) ? str(q.n_sped_min) : "",
    n_sped_max: /^\d+$/.test(str(q.n_sped_max)) ? str(q.n_sped_max) : "",
  };
}

/** Estado → query de la URL, sin los valores por defecto. */
export function serializeConsolidataListQuery(
  s: ConsolidataListUrlState,
): Record<string, string> {
  const out: Record<string, string> = {};
  (
    Object.keys(CONSOLIDATA_LIST_DEFAULTS) as Array<
      keyof ConsolidataListUrlState
    >
  ).forEach((k) => {
    const v = s[k];
    if (v !== CONSOLIDATA_LIST_DEFAULTS[k] && v !== "" && v !== 0)
      out[k] = String(v);
  });
  // `quale_data` solo significa algo con un rango de fechas.
  if (!s.date_from && !s.date_to) delete out.quale_data;
  return out;
}

/**
 * Estado que se envía cuando el usuario no ha elegido estado: sin un mosaico de
 * fase, «todos» son los no cancelados (A,P,C). El API, con `stato` ausente, solo
 * devolvería P; por eso siempre se manda.
 */
export const DEFAULT_STATES = "A,P,C";

function filterParams(s: ConsolidataListUrlState): QueryParams {
  const q: QueryParams = {};
  const put = (k: string, v: string): void => {
    if (v !== "") q[k] = v;
  };
  put("q", s.q);
  put("tipo", s.tipo);
  put("hub_terminal", s.hub_terminal);
  put("dest_country", s.dest_country);
  put("orig_paese", s.orig_paese);
  put("id_partner", s.id_partner);
  put("assegnato_a", s.assegnato_a);
  put("id_cliente", s.id_cliente);
  put("date_from", s.date_from);
  put("date_to", s.date_to);
  if ((s.date_from || s.date_to) && s.quale_data !== "insert")
    q.quale_data = s.quale_data;
  put("risposta", s.risposta);
  put("conversione", s.conversione);
  put("id_cargo", s.id_cargo);
  put("totale_min", s.totale_min);
  put("totale_max", s.totale_max);
  put("n_sped_min", s.n_sped_min);
  put("n_sped_max", s.n_sped_max);
  return q;
}

/** Estado → parámetros de view=queue (sin `view`). */
export function buildConsolidataListQuery(
  s: ConsolidataListUrlState,
): QueryParams {
  const q: QueryParams = {
    page: s.page,
    per_page: Math.min(Math.max(1, s.per_page), 100),
    sort: s.sort,
    dir: s.dir,
    ...filterParams(s),
    stato: s.stato || (s.fase ? "" : DEFAULT_STATES),
  };
  if (s.fase) q.fase = s.fase;
  return q;
}

/** Estado → parámetros de view=queue_counts (los mismos filtros sin estado, fase, página ni orden). */
export function buildConsolidataCountsQuery(
  s: ConsolidataListUrlState,
): QueryParams {
  return filterParams(s);
}

export function consolidataActiveFilterCount(
  s: ConsolidataListUrlState,
): number {
  return CONSOLIDATA_ADVANCED_KEYS.reduce(
    (n, k) =>
      n + (s[k] !== CONSOLIDATA_LIST_DEFAULTS[k] && s[k] !== "" ? 1 : 0),
    0,
  );
}

export function consolidataResetFilters(
  s: ConsolidataListUrlState,
): ConsolidataListUrlState {
  return {
    ...CONSOLIDATA_LIST_DEFAULTS,
    per_page: s.per_page,
    sort: s.sort,
    dir: s.dir,
  };
}

// ─── Mosaicos KPI ↔ fase ───────────────────────────────────────────────

export const KPI_KEYS = [
  "all",
  "sin_asignar",
  "pendiente_respuesta",
  "respondido",
  "respuesta_vencida",
  "por_convertir",
  "convertido",
  "cancelado",
] as const;
export type KpiKey = (typeof KPI_KEYS)[number];

/** Mosaico → cambio de estado del listado. «Todos» quita la fase y el estado propio (→ A,P,C). */
export function kpiToState(
  key: string,
): Pick<ConsolidataListUrlState, "fase" | "stato"> {
  if (key === "all" || !FASI.includes(key)) return { fase: "", stato: "" };
  return { fase: key, stato: "" };
}

/** Estado → mosaico activo (ninguno si hay un estado propio elegido en el cajón). */
export function activeKpi(
  s: Pick<ConsolidataListUrlState, "fase" | "stato">,
): string {
  if (s.fase)
    return (KPI_KEYS as readonly string[]).includes(s.fase) ? s.fase : "";
  return s.stato ? "" : "all";
}

/** Cifra del mosaico a partir de view=queue_counts. «Todos» = total (no cancelados). */
export function kpiCount(
  counts: QueueCounts | null,
  key: string,
): number | null {
  if (!counts) return null;
  const k = key === "all" ? "total" : (key as ProjectPhase);
  const v = counts[k];
  return typeof v === "number" ? v : null;
}

// ─── Adaptador a ListSource ─────────────────────────────────────────────

export interface ListSourceDeps {
  state: ConsolidataListUrlState;
  rows: QueueItem[];
  total: number;
  loading: boolean;
  error: string | null;
  loadPage: (page: number) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setSort: (sort: string, dir: "ASC" | "DESC") => void;
  setPerPage: (n: number) => void;
}

/** {items,count,current_page,max_page} del API → contrato ListSource de ListingDataView. */
export function toListSource(d: ListSourceDeps): ListSource<QueueItem> {
  return {
    total: d.total,
    rows: d.rows,
    loading: d.loading,
    error: d.error,
    page: d.state.page,
    perPage: d.state.per_page,
    sort: d.state.sort,
    sortDir: d.state.dir === "asc" ? "ASC" : "DESC",
    loadPage: d.loadPage,
    loadMore: d.loadMore,
    refresh: d.refresh,
    setSort: d.setSort,
    setPerPage: d.setPerPage,
  };
}

/** Aplica una página del API al acumulado (modo infinito = append). */
export function mergePage(
  prev: QueueItem[],
  res: QueuePage,
  append: boolean,
): { rows: QueueItem[]; total: number } {
  const items = Array.isArray(res.items) ? res.items : [];
  return {
    rows: append ? [...prev, ...items] : items,
    total: Number(res.count) || 0,
  };
}

function isAbort(err: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  const name = (err as { name?: string } | null)?.name;
  return name === "AbortError";
}

export const useConsolidataListStore = defineStore("consolidata_list", () => {
  const state = ref<ConsolidataListUrlState>({ ...CONSOLIDATA_LIST_DEFAULTS });
  const rows = ref<QueueItem[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<ConsolidataError | null>(null);
  const counts = ref<QueueCounts | null>(null);

  let controller: AbortController | null = null;
  let countsController: AbortController | null = null;

  function applyState(next: Partial<ConsolidataListUrlState>): void {
    state.value = { ...state.value, ...next };
  }

  function cancelInFlight(): void {
    controller?.abort();
    countsController?.abort();
    controller = null;
    countsController = null;
    loading.value = false;
    error.value = null;
  }

  async function fetchPage(append = false): Promise<void> {
    controller?.abort();
    const mine = new AbortController();
    controller = mine;
    loading.value = true;
    error.value = null;
    try {
      const res = await consolidataService.queue(
        buildConsolidataListQuery(state.value),
        {
          signal: mine.signal,
        },
      );
      if (mine.signal.aborted) return;
      const merged = mergePage(rows.value, res, append);
      rows.value = merged.rows;
      total.value = merged.total;
    } catch (err) {
      if (isAbort(err, mine.signal)) return;
      const info =
        err instanceof ConsolidataRequestError
          ? err.info
          : normalizeApiError(err);
      // El http client envuelve el abort en un error de red: si la señal se canceló, no es un fallo.
      if (mine.signal.aborted) return;
      error.value = info;
      if (!append) {
        rows.value = [];
        total.value = 0;
      }
    } finally {
      if (controller === mine) loading.value = false;
    }
  }

  /** Recuentos de los mosaicos. Fallo = mosaicos sin cifra (no rompe el listado). */
  async function fetchCounts(): Promise<void> {
    countsController?.abort();
    const mine = new AbortController();
    countsController = mine;
    try {
      const res = await consolidataService.queueCounts(
        buildConsolidataCountsQuery(state.value),
        {
          signal: mine.signal,
        },
      );
      if (!mine.signal.aborted) counts.value = res.counts ?? null;
    } catch {
      if (!mine.signal.aborted) counts.value = null;
    }
  }

  async function refresh(): Promise<void> {
    state.value.page = 1;
    await fetchPage(false);
  }

  async function loadMore(): Promise<void> {
    if (loading.value || rows.value.length >= total.value) return;
    state.value.page += 1;
    await fetchPage(true);
  }

  async function loadPage(page: number): Promise<void> {
    state.value.page = page;
    await fetchPage(false);
  }

  function setSort(sort: string, dir: "ASC" | "DESC"): void {
    if ((CONSOLIDATA_SORTS as readonly string[]).includes(sort)) {
      state.value.sort = sort as ConsolidataSort;
    }
    state.value.dir = dir === "ASC" ? "asc" : "desc";
    state.value.page = 1;
  }

  function setPerPage(n: number): void {
    state.value.per_page = Math.min(Math.max(1, n), 100);
    state.value.page = 1;
  }

  /** «Tomar» desde el listado pasa por aquí: `takingId` marca la fila y el error se normaliza. */
  const takingId = ref<number | null>(null);
  async function take(id: number): Promise<ConsolidataError | null> {
    takingId.value = id;
    try {
      await consolidataService.take(id);
      return null;
    } catch (err) {
      return err instanceof ConsolidataRequestError
        ? err.info
        : normalizeApiError(err);
    } finally {
      takingId.value = null;
    }
  }

  const bulkBusy = ref(false);
  /** Asignación masiva (bulk_assign). Devuelve cuántos fueron bien y los fallidos con su código. */
  async function bulkAssign(
    ids: number[],
    userId: number,
  ): Promise<{
    ok: number;
    failed: Array<{ id: number; code?: string }>;
    error: ConsolidataError | null;
  }> {
    bulkBusy.value = true;
    try {
      const res = await consolidataService.bulkAssign(ids, userId);
      const results = Array.isArray(res.results) ? res.results : [];
      return {
        ok: results.filter((r) => r.success).length,
        failed: results
          .filter((r) => !r.success)
          .map((r) => ({ id: r.id, code: r.code })),
        error: null,
      };
    } catch (err) {
      return {
        ok: 0,
        failed: [],
        error:
          err instanceof ConsolidataRequestError
            ? err.info
            : normalizeApiError(err),
      };
    } finally {
      bulkBusy.value = false;
    }
  }

  return {
    takingId,
    take,
    bulkBusy,
    bulkAssign,
    state,
    rows,
    total,
    loading,
    error,
    counts,
    applyState,
    cancelInFlight,
    fetchPage,
    fetchCounts,
    refresh,
    loadMore,
    loadPage,
    setSort,
    setPerPage,
  };
});
