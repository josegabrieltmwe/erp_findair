import { ref, computed, type ComputedRef } from "vue";
import { useRouter, type LocationQuery } from "vue-router";
import { http } from "@shipment/services/http";
import {
  parseShipmentListQuery,
  shipmentListHasActiveFilters,
  type ShipmentListUrlState,
} from "@shipment/stores/shipment_list.store";

/**
 * Cross-shipment navigation for the v2 layout.
 *
 * The navigator caches enough rows from the current listing filter to
 * let the operator step prev/next through the result set without
 * leaving the detail page. The cache:
 *
 *   - Speaks the SAME endpoint the listing uses (`/api_courier_shipments`)
 *     so every filter the listing supports — `type=preseint`, KPI
 *     bundles, advanced filters — also works here. Previously the
 *     navigator hit a smaller `/ajax_shipment_list` and silently dropped
 *     `type=*` so navigating from a KPI tile drifted to "all".
 *
 *   - Loads in pages of 50. When the operator approaches the end of
 *     the current page (`index >= cache.length - 2`) we prefetch the
 *     next page in background and append it to the cache, so they
 *     never hit a "Next" button that does nothing while results still
 *     exist on the server.
 *
 *   - Reports `totalAvailable` (the backend's total for the filter) so
 *     the UI can show "record 3 di 47" even when only 50 are in memory.
 *
 *   - Is keyed by the SERIALIZED filter set. Navigating between detail
 *     views under the same filter reuses the cache; opening the detail
 *     by direct URL (no filter) yields an empty cache and the panel
 *     hides itself.
 */

interface ShipmentListItem {
  id: number | string;
  cliente?: string;
  consegna_label?: string;
}

/** Subset of the api row we project to the local cache. */
interface ApiRow {
  id: number | string;
  cliente?: string;
  status?: { code?: string; label?: string };
}

interface ApiListResponse {
  data?: ApiRow[];
  pagination?: {
    total?: number;
    page?: number;
    per_page?: number;
    total_pages?: number;
  };
  error?: boolean | string;
}

const PAGE_SIZE = 50;

// Module-scope cache survives splitter/UI refreshes within the same
// filter; navigating to an unfiltered URL drops it.
const cache = ref<ShipmentListItem[]>([]);
const totalAvailable = ref<number>(0);
const loadedPages = ref<number>(0);
const loading = ref(false);
let cacheKey: string | null = null;
/** Snapshot of the listing query that produced the cache — used to
 *  fetch additional pages and to compose the "back to list" URL. */
let cacheBaseQuery: Record<string, string | number> = {};

/**
 * Map the listing state to the listing api query. We forward EVERY
 * filter the operator set on the listing — not just `search/from/to`.
 * Keep the URL surface flat so paging stays trivial (just bump
 * `page`).
 */
function stateToNavigatorQuery(
  s: ShipmentListUrlState,
): Record<string, string | number> {
  const q: Record<string, string | number> = {
    per_page: PAGE_SIZE,
    sort: s.sort,
    sort_dir: s.sort_dir,
    type: s.type,
  };
  if (s.search) q.search = s.search;
  if (s.date_from) q.date_from = s.date_from;
  if (s.date_to) q.date_to = s.date_to;
  if (s.date_field) q.date_field = s.date_field;
  if (s.id_fornitore) q.id_fornitore = s.id_fornitore;
  if (s.id_servizio) q.id_servizio = s.id_servizio;
  if (s.country_iso) q.country_iso = s.country_iso;
  if (s.city) q.city = s.city;
  if (s.id) q.id = s.id;
  if (s.id_cliente) q.id_cliente = s.id_cliente;
  if (s.AWB_forn) q.AWB_forn = s.AWB_forn;
  if (s.RIF_cliente) q.RIF_cliente = s.RIF_cliente;
  if (s.note) q.note = s.note;
  if (s.controllata) q.controllata = s.controllata;
  if (s.consegna_firma) q.consegna_firma = s.consegna_firma;
  if (s.presa_stato) q.presa_stato = s.presa_stato;
  if (s.archiviata) q.archiviata = s.archiviata;
  if (s.stato_giac) q.stato_giac = s.stato_giac;
  if (s.has_contrassegno) q.has_contrassegno = s.has_contrassegno;
  if (s.has_assicurazione) q.has_assicurazione = s.has_assicurazione;
  if (s.peso_da) q.peso_da = s.peso_da;
  if (s.peso_a) q.peso_a = s.peso_a;
  if (s.peso_tassax) q.peso_tassax = s.peso_tassax;
  if (s.chat_unread) q.chat_unread = s.chat_unread;
  return q;
}

function keyOf(q: Record<string, string | number>): string {
  return Object.keys(q)
    .sort()
    .filter((k) => k !== "page" && k !== "per_page") // page is internal pagination
    .map((k) => `${k}=${q[k]}`)
    .join("&");
}

function clearCache(): void {
  cache.value = [];
  totalAvailable.value = 0;
  loadedPages.value = 0;
  cacheKey = null;
  cacheBaseQuery = {};
}

function projectRow(r: ApiRow): ShipmentListItem {
  return {
    id: r.id,
    cliente: r.cliente,
    consegna_label: r.status?.label,
  };
}

async function fetchPage(page: number): Promise<ApiListResponse | null> {
  try {
    const res = await http<ApiListResponse>("/api_courier_shipments", {
      query: { ...cacheBaseQuery, page },
    });
    if (res.error) return null;
    return res;
  } catch {
    return null;
  }
}

async function ensureLoaded(routeQuery: LocationQuery): Promise<void> {
  if (loading.value) return;
  const state = parseShipmentListQuery(routeQuery as Record<string, unknown>);
  if (!shipmentListHasActiveFilters(state)) {
    clearCache();
    return;
  }
  const query = stateToNavigatorQuery(state);
  const key = keyOf(query);
  if (key === cacheKey) return;

  loading.value = true;
  try {
    cacheBaseQuery = query;
    const res = await fetchPage(1);
    if (res && Array.isArray(res.data)) {
      cache.value = res.data.map(projectRow);
      totalAvailable.value = res.pagination?.total ?? cache.value.length;
      loadedPages.value = 1;
      cacheKey = key;
    } else {
      clearCache();
    }
  } finally {
    loading.value = false;
  }
}

/**
 * Append the next page to the cache without blocking the UI. Called
 * automatically by `goNext()` when the operator approaches the tail
 * of the local cache.
 */
async function prefetchNextPage(): Promise<void> {
  if (loading.value) return;
  if (cache.value.length >= totalAvailable.value) return;
  loading.value = true;
  try {
    const nextPage = loadedPages.value + 1;
    const res = await fetchPage(nextPage);
    if (res && Array.isArray(res.data) && res.data.length > 0) {
      cache.value = [...cache.value, ...res.data.map(projectRow)];
      loadedPages.value = nextPage;
    }
  } finally {
    loading.value = false;
  }
}

export function useRecordNavigator(
  currentId: ComputedRef<number | null>,
  /**
   * Modo de navegación. Por defecto 'page' → push a `/shipment/:id`.
   * En 'overlay' (modal del listado) → push a `shipment-list?view=:id`
   * preservando los filtros, de modo que el detalle se mueve dentro del
   * modal sin abandonar el listado.
   */
  options: { overlay?: ComputedRef<boolean> | boolean } = {},
): {
  records: ComputedRef<ShipmentListItem[]>;
  index: ComputedRef<number>;
  /** Items currently in memory. */
  cached: ComputedRef<number>;
  /** Total rows available on the server for this filter. */
  total: ComputedRef<number>;
  hasPrev: ComputedRef<boolean>;
  hasNext: ComputedRef<boolean>;
  loading: ComputedRef<boolean>;
  ensureLoaded: (routeQuery: LocationQuery) => Promise<void>;
  goPrev: () => void;
  goNext: () => void;
  goTo: (id: number | string) => void;
} {
  const router = useRouter();
  const isOverlay = (): boolean =>
    typeof options.overlay === "object"
      ? options.overlay.value
      : !!options.overlay;

  const index = computed<number>(() => {
    const id = currentId.value;
    if (id == null) return -1;
    return cache.value.findIndex((r) => String(r.id) === String(id));
  });

  const cached = computed<number>(() => cache.value.length);
  const total = computed<number>(() => totalAvailable.value);
  const hasPrev = computed<boolean>(() => index.value > 0);
  /** Has next: either another row in cache, or more pages on server. */
  const hasNext = computed<boolean>(() => {
    if (index.value < 0) return false;
    if (index.value < cache.value.length - 1) return true;
    return cache.value.length < totalAvailable.value;
  });

  function maybePrefetch(): void {
    // Trigger the prefetch when the operator is within 2 records of
    // the tail — small enough to be unsurprising, big enough that the
    // next page usually lands before they keep pressing →.
    if (
      index.value >= cache.value.length - 2 &&
      cache.value.length < totalAvailable.value
    ) {
      void prefetchNextPage();
    }
  }

  /**
   * Navega al detalle del `id` preservando el query (que lleva el filtro
   * del listado, base del cache del navegador).
   *
   * - modo página: push a la ruta con nombre `shipment-detail` (independiente
   *   de la base del router; dentro de `operations` las rutas de shipment están
   *   anidadas bajo `/shipment`, un `path` relativo `/<id>` resolvía a
   *   not-found).
   * - modo overlay: push a `shipment-list` con `?view=<id>` (mantiene el
   *   listado de fondo y mueve el detalle dentro del modal).
   */
  function pushDetail(id: number | string): void {
    const query = { ...router.currentRoute.value.query };
    if (isOverlay()) {
      router.push({
        name: "shipment-list",
        query: { ...query, view: String(id) },
      });
    } else {
      router.push({
        name: "shipment-detail",
        params: { id: String(id) },
        query,
      });
    }
  }

  function goPrev(): void {
    if (!hasPrev.value) return;
    const target = cache.value[index.value - 1];
    if (target) pushDetail(target.id);
  }

  function goNext(): void {
    if (!hasNext.value) return;
    const nextIdx = index.value + 1;
    // If the next index is still in cache, jump straight away.
    const target = cache.value[nextIdx];
    if (target) {
      pushDetail(target.id);
      maybePrefetch();
      return;
    }
    // Otherwise we are at the very last cached row but more pages
    // exist — fetch the next page synchronously and then move.
    void (async () => {
      await prefetchNextPage();
      const after = cache.value[nextIdx];
      if (after) pushDetail(after.id);
    })();
  }

  function goTo(id: number | string): void {
    pushDetail(id);
  }

  return {
    records: computed(() => cache.value),
    index,
    cached,
    total,
    hasPrev,
    hasNext,
    loading: computed(() => loading.value),
    ensureLoaded,
    goPrev,
    goNext,
    goTo,
  };
}
