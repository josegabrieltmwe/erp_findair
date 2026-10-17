import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { isAbortLikeError, toUserMessage } from "@tmwe/shared-frontend/http";
import {
  cargoListService,
  type CargoListRow,
  type CargoListQuery,
} from "@cargo/services/cargo.service";
import { i18n } from "@cargo/plugins/i18n";
import { HOME_KPI_CATALOG } from "@shared/dashboard/home_kpi_catalog";

const LISTING_BASE_TYPES = ["all", "in_transit"] as const;

/** Keys from the home dashboard catalog that target the cargo listing. */
const HOME_CARGO_KEYS: ReadonlySet<string> = new Set(
  HOME_KPI_CATALOG.filter((k) => k.link.page === "cargo-list")
    .map((k) => k.link.query.type)
    .filter((t): t is string => typeof t === "string"),
);

/**
 * Runtime guard for the URL `type` param. Accepts the cargo listing's
 * own macro categories (`all`, `in_transit`) plus any home-tile KPI
 * key. Unknown values fall back to `all`.
 */
function normalisedType(raw: unknown): string {
  if (typeof raw !== "string") return "all";
  if ((LISTING_BASE_TYPES as readonly string[]).includes(raw)) return raw;
  if (HOME_CARGO_KEYS.has(raw)) return raw;
  return "all";
}

/**
 * Subset of CargoListQuery actually surfaced in the URL. Keeping the
 * URL surface small avoids leaking internal defaults (sort, type='all')
 * into every link and keeps the back/forward history readable.
 */
export interface CargoListUrlState {
  page: number;
  per_page: number;
  /**
   * Listing type. Accepts the macro categories (`all`, `in_transit`)
   * plus any KPI key from the home dashboard catalog (`toqt`, `clwt`,
   * `nofly`, …). Validated at parse time via `normalisedType`.
   */
  type: string;
  /** Semantic dashboard tile key; UI-only, never sent to the list endpoint. */
  kpi: string;
  search: string;
  date_from: string;
  date_to: string;
  /**
   * Which cargo date column the date range filters on:
   * 'data_sped1' (shipped) or 'data_volo_partenza' (flight departure).
   * Backend: Cargo_Filter_Analyzer::build_date_range_condition.
   */
  quale_data: "data_sped1" | "data_volo_partenza";
  airline_code: string;
  terminal_part: string;
  terminal_dest: string;
  /** Country ISO-2 filter; pairs with cerca_pd to target origin/destination. */
  paesex: string;
  /** 'P' = origin, 'D' = destination. Required by the backend with paesex. */
  cerca_pd: string;
  sort: NonNullable<CargoListQuery["sort"]>;
  sort_dir: "ASC" | "DESC";
  // W3 — cargo lifecycle filters (legacy `spedyc_cerca.php`).
  // NOTE: cargo schema differs from express. Filters that ONLY exist
  // in `spedizioni` (and not in `spedizioni_cargo`) are intentionally
  // absent — see Cargo_Filter_Analyzer for the rationale.
  id: string;
  id_cliente: string;
  AWB_forn: string;
  RIF_cliente: string;
  note: string;
  gestione: string; // N / F / O
  offerta: string; // A / R / ''
  tipo_merce: string; // DOC / NDC / SPL
  vettore_tipo: string; // AIR / SEA / LCL / FCL
  flight_num1: string;
  cargo_dazi: string;
  controllata: string; // S / N (NOT 'O' — that's express-only)
  archiviata: string;
  consegna_firma: string;
  peso_da: string;
  peso_a: string;
  pesor: string; // chargeable weight column on cargo (NOT peso_tassato)
  has_assicurazione: string;
  acc_dryice: string;
  acc_danggoods: string;
  acc_bancale: string;
  /**
   * '1' = only shipments with unread chat messages. Entry point is the
   * chat badge in the platform bar (PlatformChatBadge.vue), which links to
   * `/cargo/list?chat_unread=1`. Backend: Cargo_Filter_Analyzer 'chat_unread'.
   */
  chat_unread: string;
}

export const CARGO_LIST_DEFAULTS: CargoListUrlState = {
  page: 1,
  per_page: 25,
  type: "all",
  kpi: "",
  search: "",
  date_from: "",
  date_to: "",
  quale_data: "data_sped1",
  airline_code: "",
  terminal_part: "",
  terminal_dest: "",
  paesex: "",
  cerca_pd: "",
  sort: "sp.data_sped1",
  sort_dir: "DESC",
  // W3 extended filters defaults.
  id: "",
  id_cliente: "",
  AWB_forn: "",
  RIF_cliente: "",
  note: "",
  gestione: "",
  offerta: "",
  tipo_merce: "",
  vettore_tipo: "",
  flight_num1: "",
  cargo_dazi: "",
  controllata: "",
  archiviata: "",
  consegna_firma: "",
  peso_da: "",
  peso_a: "",
  pesor: "",
  has_assicurazione: "",
  acc_dryice: "",
  acc_danggoods: "",
  acc_bancale: "",
  chat_unread: "",
};

/** All semantic filters. Presentation state (page size/sort) is excluded. */
export const CARGO_FILTER_KEYS: ReadonlyArray<keyof CargoListUrlState> = [
  "type", "search", "date_from", "date_to", "airline_code", "terminal_part",
  "terminal_dest", "paesex", "id", "id_cliente", "AWB_forn", "RIF_cliente",
  "note", "gestione", "offerta", "tipo_merce", "vettore_tipo", "flight_num1",
  "cargo_dazi", "controllata", "archiviata", "consegna_firma", "peso_da",
  "peso_a", "pesor", "has_assicurazione", "acc_dryice", "acc_danggoods",
  "acc_bancale", "chat_unread",
];

export function cargoActiveFilterCount(s: CargoListUrlState): number {
  return CARGO_FILTER_KEYS.reduce((count, key) => {
    const value = s[key];
    const defaultValue = CARGO_LIST_DEFAULTS[key];
    return count + (value !== defaultValue && value !== "" ? 1 : 0);
  }, 0);
}

export function cargoResetFilters(s: CargoListUrlState): CargoListUrlState {
  return {
    ...CARGO_LIST_DEFAULTS,
    per_page: s.per_page,
    sort: s.sort,
    sort_dir: s.sort_dir,
  };
}

function asNumber(v: unknown, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Parse vue-router LocationQuery into our state shape. Unknown keys are
 * ignored; missing keys fall back to defaults.
 */
export function parseCargoListQuery(
  q: Record<string, unknown>,
): CargoListUrlState {
  const type = normalisedType(q.type);
  // Whitelist mirrors backend Cargo_Shipments_Request_Handler::ALLOWED_SORT_FIELDS.
  // MUST stay in sync with the backend: a value missing here is silently
  // reverted to the default on the URL→state round-trip, so clicking the
  // Origin/Destination headers (sp.terminal_part/_dest) would "snap back".
  const ALLOWED_SORTS = [
    "sp.data_sped0",
    "sp.data_sped1",
    "sp.data_volo_partenza",
    "sp.consegna_data",
    "sp.AWB_forn",
    "sp.id",
    "sp.colli",
    "sp.peso",
    "sp.peso_reale",
    "sp.vettore_sigla",
    "sp.carico_volo",
    "sp.carico_extra",
    "sp.terminal_part",
    "sp.terminal_dest",
    "ang.rag_soc",
    "spi.id_paese_iso",
    "spi2.id_paese_iso",
  ];
  const sort =
    typeof q.sort === "string" && ALLOWED_SORTS.includes(q.sort)
      ? q.sort
      : CARGO_LIST_DEFAULTS.sort;
  const sort_dir = q.sort_dir === "ASC" ? "ASC" : "DESC";
  return {
    page: asNumber(q.page, CARGO_LIST_DEFAULTS.page),
    per_page: asNumber(q.per_page, CARGO_LIST_DEFAULTS.per_page),
    type,
    kpi: asString(q.kpi),
    search: asString(q.search),
    date_from: asString(q.date_from),
    date_to: asString(q.date_to),
    quale_data:
      q.quale_data === "data_volo_partenza"
        ? "data_volo_partenza"
        : "data_sped1",
    airline_code: asString(q.airline_code),
    terminal_part: asString(q.terminal_part),
    terminal_dest: asString(q.terminal_dest),
    paesex: asString(q.paesex),
    cerca_pd: asString(q.cerca_pd),
    sort: sort as CargoListUrlState["sort"],
    sort_dir,
    // W3 extended filters round-trip from URL.
    id: asString(q.id),
    id_cliente: asString(q.id_cliente),
    AWB_forn: asString(q.AWB_forn),
    RIF_cliente: asString(q.RIF_cliente),
    note: asString(q.note),
    gestione: asString(q.gestione),
    offerta: asString(q.offerta),
    tipo_merce: asString(q.tipo_merce),
    vettore_tipo: asString(q.vettore_tipo),
    flight_num1: asString(q.flight_num1),
    cargo_dazi: asString(q.cargo_dazi),
    controllata: asString(q.controllata),
    archiviata: asString(q.archiviata),
    consegna_firma: asString(q.consegna_firma),
    peso_da: asString(q.peso_da),
    peso_a: asString(q.peso_a),
    pesor: asString(q.pesor),
    has_assicurazione: asString(q.has_assicurazione),
    acc_dryice: asString(q.acc_dryice),
    acc_danggoods: asString(q.acc_danggoods),
    acc_bancale: asString(q.acc_bancale),
    chat_unread: asString(q.chat_unread),
  };
}

/**
 * True when the state holds at least one user-applied filter.
 * Reused by the cross-record navigator on the detail page so the panel
 * only shows up when the operator arrived from a filtered listing.
 */
export function cargoListHasActiveFilters(s: CargoListUrlState): boolean {
  return cargoActiveFilterCount(s) > 0;
}

/**
 * Project current state to a vue-router query object, omitting fields
 * that match the default. This produces clean URLs like
 *   /list?search=ABC
 * instead of
 *   /list?page=1&per_page=25&type=all&search=ABC&sort=...
 */
export function serializeCargoListQuery(
  s: CargoListUrlState,
): Record<string, string> {
  const out: Record<string, string> = {};
  (Object.keys(CARGO_LIST_DEFAULTS) as Array<keyof CargoListUrlState>).forEach(
    (k) => {
      const v = s[k];
      const d = CARGO_LIST_DEFAULTS[k];
      if (v !== d && v !== "" && v !== 0) {
        out[k] = String(v);
      }
    },
  );
  return out;
}

/**
 * Build the backend query from the listing state.
 *
 * Exported because the export feature sends the SAME params: the file must
 * match what is on screen, and a second copy of this mapping would drift the
 * first time a filter is added. See ShipmentExportMenu.
 */
export function buildCargoListQuery(s: CargoListUrlState): CargoListQuery {
  return {
    page: s.page,
    per_page: s.per_page,
    type: s.type,
    sort: s.sort,
    sort_dir: s.sort_dir,
    search: s.search || undefined,
    date_from: s.date_from || undefined,
    date_to: s.date_to || undefined,
    // Only send the date-column selector when a range is actually set and
    // the user picked the non-default column; otherwise the backend uses
    // its own default (data_sped1) and the request stays clean.
    quale_data:
      (s.date_from || s.date_to) && s.quale_data !== "data_sped1"
        ? s.quale_data
        : undefined,
    airline_code: s.airline_code || undefined,
    terminal_part: s.terminal_part || undefined,
    terminal_dest: s.terminal_dest || undefined,
    // paesex only filters when paired with cerca_pd (P/D); send both or
    // neither so the backend never gets a dangling country.
    paesex: s.paesex && s.cerca_pd ? s.paesex : undefined,
    cerca_pd: s.paesex && s.cerca_pd ? s.cerca_pd : undefined,
    // W3 — cargo lifecycle filters.
    id: s.id ? Number(s.id) : undefined,
    id_cliente: s.id_cliente ? Number(s.id_cliente) : undefined,
    AWB_forn: s.AWB_forn || undefined,
    RIF_cliente: s.RIF_cliente || undefined,
    note: s.note || undefined,
    gestione: (s.gestione || undefined) as CargoListQuery["gestione"],
    offerta: (s.offerta || undefined) as CargoListQuery["offerta"],
    tipo_merce: s.tipo_merce || undefined,
    vettore_tipo: s.vettore_tipo || undefined,
    flight_num1: s.flight_num1 || undefined,
    cargo_dazi: s.cargo_dazi || undefined,
    controllata: (s.controllata || undefined) as CargoListQuery["controllata"],
    archiviata: (s.archiviata || undefined) as CargoListQuery["archiviata"],
    consegna_firma: (s.consegna_firma ||
      undefined) as CargoListQuery["consegna_firma"],
    peso_da: s.peso_da || undefined,
    peso_a: s.peso_a || undefined,
    pesor: s.pesor || undefined,
    has_assicurazione: (s.has_assicurazione ||
      undefined) as CargoListQuery["has_assicurazione"],
    acc_dryice: (s.acc_dryice || undefined) as CargoListQuery["acc_dryice"],
    acc_danggoods: (s.acc_danggoods ||
      undefined) as CargoListQuery["acc_danggoods"],
    acc_bancale: (s.acc_bancale || undefined) as CargoListQuery["acc_bancale"],
    chat_unread: s.chat_unread ? "1" : undefined,
  };
}

export const useCargoListStore = defineStore("cargo_list", () => {
  const state = ref<CargoListUrlState>({ ...CARGO_LIST_DEFAULTS });
  const rows = ref<CargoListRow[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastQueryMs = ref<number | null>(null);

  /** Currently-active AbortController so a newer call can cancel the older one. */
  let controller: AbortController | null = null;

  const hasActiveFilters = computed<boolean>(() =>
    cargoListHasActiveFilters(state.value),
  );

  /** Replace the entire state at once (used on URL sync). */
  function applyState(next: Partial<CargoListUrlState>): void {
    state.value = { ...state.value, ...next };
  }

  function reset(): void {
    state.value = { ...CARGO_LIST_DEFAULTS };
  }

  /**
   * Cancel the in-flight request and drop any stale error.
   *
   * Call it when leaving the listing: the store is a module singleton, so an
   * error left behind here would be rendered again the next time the page
   * mounts, long after it stopped being true.
   */
  function cancelInFlight(): void {
    if (controller) controller.abort();
    controller = null;
    loading.value = false;
    error.value = null;
  }

  /**
   * Fetch one page. When `append=true` the result is *appended* to the current
   * `rows` array (infinite scroll). Otherwise it *replaces* them.
   */
  async function fetchPage(append = false): Promise<void> {
    if (controller) controller.abort();
    const myController = new AbortController();
    controller = myController;
    loading.value = true;
    error.value = null;
    const s = state.value;
    const query: CargoListQuery = buildCargoListQuery(s);
    try {
      const r = await cargoListService.fetch(query, {
        signal: myController.signal,
      });
      if (r.error) {
        error.value = r.message ?? "Failed to load cargo shipments";
        if (!append) {
          rows.value = [];
          total.value = 0;
        }
        return;
      }
      rows.value = append ? [...rows.value, ...r.data] : r.data;
      total.value = r.pagination.total;
      lastQueryMs.value = r.meta.query_time_ms ?? null;
    } catch (err) {
      // A cancelled request is expected, not an error: a newer fetch
      // superseded this one (filter/sort change, infinite-scroll pump), or the
      // user navigated away and the browser killed the connection. Swallow it
      // without touching `loading`/`error`, which now belong to the newer
      // request. See isAbortLikeError for why `err.name` alone is not enough.
      if (isAbortLikeError(err, myController.signal)) return;
      error.value = toUserMessage(err, i18n.global.t("listing.error.network"));
    } finally {
      // Only the *current* request may clear the spinner. A stale aborted
      // request must not flip `loading` off under the newer one's feet.
      if (controller === myController) loading.value = false;
    }
  }

  /** Reload from page 1, replacing all rows. Called when filters change. */
  async function refresh(): Promise<void> {
    state.value.page = 1;
    await fetchPage(false);
  }

  /** Advance to next page and append the result. Used by infinite scroll. */
  async function loadMore(): Promise<void> {
    if (loading.value) return;
    if (rows.value.length >= total.value) return;
    state.value.page += 1;
    await fetchPage(true);
  }

  /** Replace data with the given page number (used by v-data-table-server). */
  async function loadPage(page: number): Promise<void> {
    state.value.page = page;
    await fetchPage(false);
  }

  function setSort(sort: string, dir: "ASC" | "DESC"): void {
    state.value.sort = sort as CargoListUrlState["sort"];
    state.value.sort_dir = dir;
    state.value.page = 1;
  }

  function setPerPage(n: number): void {
    state.value.per_page = n;
    state.value.page = 1;
  }

  return {
    state,
    rows,
    total,
    loading,
    error,
    lastQueryMs,
    hasActiveFilters,
    applyState,
    reset,
    fetchPage,
    cancelInFlight,
    refresh,
    loadMore,
    loadPage,
    setSort,
    setPerPage,
  };
});
