import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { isAbortLikeError, toUserMessage } from "@tmwe/shared-frontend/http";
import {
  shipmentListService,
  type ShipmentListRow,
  type ShipmentListQuery,
} from "@shipment/services/shipment.service";
import { i18n } from "@shipment/plugins/i18n";
import { HOME_KPI_CATALOG } from "@shared/dashboard/home_kpi_catalog";

/**
 * Macro categories the listing's own KPI strip exposes (not from the
 * home catalog). These coexist with the home-tile types like
 * `preseint`, `dacontr`, … which arrive via deep-link.
 */
const LISTING_BASE_TYPES = [
  "all",
  "in_transit",
  "cod_pending",
  "pickup_status",
] as const;

/** Keys from the home dashboard catalog that target the courier listing. */
const HOME_COURIER_KEYS: ReadonlySet<string> = new Set(
  HOME_KPI_CATALOG.filter((k) => k.link.page === "shipment-list")
    .map((k) => k.link.query.type)
    .filter((t): t is string => typeof t === "string"),
);

/**
 * Runtime guard: accept either a listing macro type or any home-tile
 * KPI key the catalog knows about. Anything else falls back to `all`
 * (the deep-link still gets the data, but the type is normalised).
 */
function normalisedType(raw: unknown): string {
  if (typeof raw !== "string") return "all";
  if ((LISTING_BASE_TYPES as readonly string[]).includes(raw)) return raw;
  if (HOME_COURIER_KEYS.has(raw)) return raw;
  return "all";
}

/**
 * Subset of ShipmentListQuery surfaced in the URL. The handler accepts
 * 60+ params; only the most commonly used filters are deep-linkable to
 * keep URLs readable. Advanced filters can be added later via Fase 3.
 */
export interface ShipmentListUrlState {
  page: number;
  per_page: number;
  /**
   * Listing type. Accepts the four macro categories
   * (`all` / `in_transit` / `cod_pending` / `pickup_status`) PLUS any
   * KPI key from the home dashboard catalog (`preseint`, `dacontr`,
   * `badaddr`, …). Validation happens in `parseShipmentListQuery` via
   * `normalisedType`.
   */
  type: string;
  /** Semantic dashboard tile key; UI-only, never sent to the list endpoint. */
  kpi: string;
  search: string;
  date_from: string;
  date_to: string;
  date_field: "data_sped0" | "data_sped1" | "data_corriere" | "consegna_data";
  id_fornitore: string;
  id_servizio: string;
  /** Country ISO-2 filter. Pairs with `location_type` to target origin/dest. */
  country_iso: string;
  /** 'P' = origin (pickup), 'D' = destination (delivery). Required by the
   *  backend together with country_iso — without it the country filter is a no-op. */
  location_type: string;
  city: string;
  sort: NonNullable<ShipmentListQuery["sort"]>;
  sort_dir: "ASC" | "DESC";
  // W2.D3 — extended filters (parity with legacy `spedy_cerca.php`).
  // Each field is wired to Filter_Analyzer via the request handler.
  id: string;
  id_cliente: string;
  AWB_forn: string;
  RIF_cliente: string;
  note: string;
  controllata: string; // S / N / O
  consegna_firma: string; // S / N
  presa_stato: string; // N / W / F / C / T
  archiviata: string; // S / N
  stato_giac: string; // S / A / X / N
  has_contrassegno: string; // S
  has_assicurazione: string; // S
  peso_da: string;
  peso_a: string;
  peso_tassax: string; // exact match (legacy parity)
  /**
   * '1' = only shipments with unread chat messages. Entry point is the
   * chat badge in the platform bar (PlatformChatBadge.vue), which links to
   * `/shipment/list?chat_unread=1`. Backend: Filter_Analyzer 'chat_unread'.
   */
  chat_unread: string;
}

export const SHIPMENT_LIST_DEFAULTS: ShipmentListUrlState = {
  page: 1,
  per_page: 25,
  type: "all",
  kpi: "",
  search: "",
  date_from: "",
  date_to: "",
  date_field: "data_sped1",
  id_fornitore: "",
  id_servizio: "",
  country_iso: "",
  location_type: "",
  city: "",
  sort: "sp.data_sped1",
  sort_dir: "DESC",
  // W2.D3 extended filters defaults — all empty (no filter).
  id: "",
  id_cliente: "",
  AWB_forn: "",
  RIF_cliente: "",
  note: "",
  controllata: "",
  consegna_firma: "",
  presa_stato: "",
  archiviata: "",
  stato_giac: "",
  has_contrassegno: "",
  has_assicurazione: "",
  peso_da: "",
  peso_a: "",
  peso_tassax: "",
  chat_unread: "",
};

/** All semantic filters. Presentation state (page size/sort) is excluded. */
export const SHIPMENT_FILTER_KEYS: ReadonlyArray<keyof ShipmentListUrlState> = [
  "type", "search", "date_from", "date_to", "id_fornitore", "id_servizio",
  "country_iso", "city", "id", "id_cliente", "AWB_forn", "RIF_cliente",
  "note", "controllata", "consegna_firma", "presa_stato", "archiviata",
  "stato_giac", "has_contrassegno", "has_assicurazione", "peso_da",
  "peso_a", "peso_tassax", "chat_unread",
];

export function shipmentActiveFilterCount(s: ShipmentListUrlState): number {
  return SHIPMENT_FILTER_KEYS.reduce((count, key) => {
    const value = s[key];
    const defaultValue = SHIPMENT_LIST_DEFAULTS[key];
    return count + (value !== defaultValue && value !== "" ? 1 : 0);
  }, 0);
}

export function shipmentResetFilters(
  s: ShipmentListUrlState,
): ShipmentListUrlState {
  return {
    ...SHIPMENT_LIST_DEFAULTS,
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

export function parseShipmentListQuery(
  q: Record<string, unknown>,
): ShipmentListUrlState {
  const type = normalisedType(q.type);
  const date_field =
    q.date_field === "data_sped0" ||
    q.date_field === "data_corriere" ||
    q.date_field === "consegna_data"
      ? q.date_field
      : "data_sped1";
  // Whitelist mirrors backend Shipments_List_Request_Handler::ALLOWED_SORT_FIELDS.
  // MUST stay in sync with the backend ALLOWED_SORT_FIELDS: a value missing
  // here is silently reverted to the default on the URL→state round-trip, so
  // clicking the Destination header (spi2.id_paese_iso) would "snap back".
  const ALLOWED_SORTS = [
    "sp.data_sped0",
    "sp.data_sped1",
    "sp.data_corriere",
    "sp.consegna_data",
    "sp.AWB_forn",
    "sp.id",
    "sp.colli",
    "sp.peso",
    "sp.peso_tassato",
    "sp.peso_reale",
    "sp.id_fornitore",
    "sp.id_servizio",
    "sp.consegna_stato",
    "sp.controllata",
    "ang.rag_soc",
    "spi.id_paese_iso",
    "spi2.id_paese_iso",
  ];
  const sort =
    typeof q.sort === "string" && ALLOWED_SORTS.includes(q.sort)
      ? q.sort
      : SHIPMENT_LIST_DEFAULTS.sort;
  const sort_dir = q.sort_dir === "ASC" ? "ASC" : "DESC";
  return {
    page: asNumber(q.page, SHIPMENT_LIST_DEFAULTS.page),
    per_page: asNumber(q.per_page, SHIPMENT_LIST_DEFAULTS.per_page),
    type,
    kpi: asString(q.kpi),
    search: asString(q.search),
    date_from: asString(q.date_from),
    date_to: asString(q.date_to),
    date_field: date_field as ShipmentListUrlState["date_field"],
    id_fornitore: asString(q.id_fornitore),
    id_servizio: asString(q.id_servizio),
    country_iso: asString(q.country_iso),
    location_type: asString(q.location_type),
    city: asString(q.city),
    sort: sort as ShipmentListUrlState["sort"],
    sort_dir,
    // W2.D3 extended filters — string round-trip from URL.
    id: asString(q.id),
    id_cliente: asString(q.id_cliente),
    AWB_forn: asString(q.AWB_forn),
    RIF_cliente: asString(q.RIF_cliente),
    note: asString(q.note),
    controllata: asString(q.controllata),
    consegna_firma: asString(q.consegna_firma),
    presa_stato: asString(q.presa_stato),
    archiviata: asString(q.archiviata),
    stato_giac: asString(q.stato_giac),
    has_contrassegno: asString(q.has_contrassegno),
    has_assicurazione: asString(q.has_assicurazione),
    peso_da: asString(q.peso_da),
    peso_a: asString(q.peso_a),
    peso_tassax: asString(q.peso_tassax),
    chat_unread: asString(q.chat_unread),
  };
}

/**
 * True when the state holds at least one user-applied filter.
 * Reused by the cross-record navigator on the detail page so the panel
 * only shows up when the operator arrived from a filtered listing.
 */
export function shipmentListHasActiveFilters(s: ShipmentListUrlState): boolean {
  return shipmentActiveFilterCount(s) > 0;
}

export function serializeShipmentListQuery(
  s: ShipmentListUrlState,
): Record<string, string> {
  const out: Record<string, string> = {};
  (
    Object.keys(SHIPMENT_LIST_DEFAULTS) as Array<keyof ShipmentListUrlState>
  ).forEach((k) => {
    const v = s[k];
    const d = SHIPMENT_LIST_DEFAULTS[k];
    if (v !== d && v !== "" && v !== 0) {
      out[k] = String(v);
    }
  });
  return out;
}

/**
 * Build the backend query from the listing state.
 *
 * Exported because the export feature sends the SAME params: the file must
 * match what is on screen, and a second copy of this mapping would drift the
 * first time a filter is added. See ShipmentExportMenu.
 */
export function buildShipmentListQuery(
  s: ShipmentListUrlState,
): ShipmentListQuery {
  return {
    page: s.page,
    per_page: s.per_page,
    type: s.type,
    sort: s.sort,
    sort_dir: s.sort_dir,
    search: s.search || undefined,
    date_from: s.date_from || undefined,
    date_to: s.date_to || undefined,
    date_field: s.date_field,
    id_fornitore: s.id_fornitore ? Number(s.id_fornitore) : undefined,
    id_servizio: s.id_servizio ? Number(s.id_servizio) : undefined,
    // country_iso only filters when paired with location_type (P/D);
    // send both or neither so the backend never gets a dangling country.
    country_iso: s.country_iso && s.location_type ? s.country_iso : undefined,
    location_type:
      s.country_iso && s.location_type ? s.location_type : undefined,
    city: s.city || undefined,
    // W2.D3 — extended filters (legacy parity).
    id: s.id ? Number(s.id) : undefined,
    id_cliente: s.id_cliente ? Number(s.id_cliente) : undefined,
    AWB_forn: s.AWB_forn || undefined,
    RIF_cliente: s.RIF_cliente || undefined,
    note: s.note || undefined,
    controllata: (s.controllata ||
      undefined) as ShipmentListQuery["controllata"],
    consegna_firma: (s.consegna_firma ||
      undefined) as ShipmentListQuery["consegna_firma"],
    presa_stato: s.presa_stato || undefined,
    archiviata: (s.archiviata || undefined) as ShipmentListQuery["archiviata"],
    stato_giac: s.stato_giac || undefined,
    // Backend requires the literal 'S' (Shipments_List_Request_Handler
    // checks `=== 'S'`); state already stores 'S'/'' so forward it as-is.
    // Sending '1' here silently disabled both switches.
    has_contrassegno: s.has_contrassegno === "S" ? "S" : undefined,
    has_assicurazione: s.has_assicurazione === "S" ? "S" : undefined,
    peso_da: s.peso_da || undefined,
    peso_a: s.peso_a || undefined,
    peso_tassax: s.peso_tassax || undefined,
    chat_unread: s.chat_unread ? "1" : undefined,
  };
}

export const useShipmentListStore = defineStore("shipment_list", () => {
  const state = ref<ShipmentListUrlState>({ ...SHIPMENT_LIST_DEFAULTS });
  const rows = ref<ShipmentListRow[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastQueryMs = ref<number | null>(null);

  let controller: AbortController | null = null;

  const hasActiveFilters = computed<boolean>(() =>
    shipmentListHasActiveFilters(state.value),
  );

  function applyState(next: Partial<ShipmentListUrlState>): void {
    state.value = { ...state.value, ...next };
  }

  function reset(): void {
    state.value = { ...SHIPMENT_LIST_DEFAULTS };
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
   * Fetch one page. When `append=true` the result is appended to the
   * current rows array (infinite scroll). Otherwise replaces them.
   */
  async function fetchPage(append = false): Promise<void> {
    if (controller) controller.abort();
    const myController = new AbortController();
    controller = myController;
    loading.value = true;
    error.value = null;
    const s = state.value;
    const query: ShipmentListQuery = buildShipmentListQuery(s);
    try {
      const r = await shipmentListService.fetch(query, {
        signal: myController.signal,
      });
      if (r.error) {
        error.value = r.message ?? "Failed to load shipments";
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

  async function refresh(): Promise<void> {
    state.value.page = 1;
    await fetchPage(false);
  }

  async function loadMore(): Promise<void> {
    if (loading.value) return;
    if (rows.value.length >= total.value) return;
    state.value.page += 1;
    await fetchPage(true);
  }

  async function loadPage(page: number): Promise<void> {
    state.value.page = page;
    await fetchPage(false);
  }

  function setSort(sort: string, dir: "ASC" | "DESC"): void {
    state.value.sort = sort as ShipmentListUrlState["sort"];
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
