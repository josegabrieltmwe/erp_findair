import { ref, computed, type ComputedRef } from "vue";
import { useRouter, type LocationQuery } from "vue-router";
import { http } from "@cargo/services/http";
import {
  parseCargoListQuery,
  cargoListHasActiveFilters,
  type CargoListUrlState,
} from "@cargo/stores/cargo_list.store";

/**
 * Cross-cargo navigation for the v2 layout. Mirror of the shipment
 * useRecordNavigator composable so the DetailShell sidebar can show
 * the current filter's records and let the operator hop between them
 * without leaving the detail page.
 *
 * Key behaviours (shared with the express implementation):
 *   - Speaks the SAME endpoint the listing uses (`/api_cargo_shipments`)
 *     so every filter the listing accepts also works here — including
 *     the home-tile KPI keys (`type=clwt`, `type=nofly`, …).
 *   - Loads in pages of 50; prefetches the next page when the operator
 *     is within 2 records of the tail.
 *   - Reports `totalAvailable` (backend's filter total) so the UI can
 *     show "record 3 di 47" even when only 50 are in memory.
 *   - Module-scope cache survives splitter/UI refreshes within the
 *     same filter; navigating to an unfiltered URL drops it.
 */

interface CargoListItem {
  id: number | string;
  cliente?: string;
  consegna_label?: string;
}

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

const cache = ref<CargoListItem[]>([]);
const totalAvailable = ref<number>(0);
const loadedPages = ref<number>(0);
const loading = ref(false);
let cacheKey: string | null = null;
let cacheBaseQuery: Record<string, string | number> = {};

function stateToNavigatorQuery(
  s: CargoListUrlState,
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
  if (s.airline_code) q.airline_code = s.airline_code;
  if (s.terminal_part) q.terminal_part = s.terminal_part;
  if (s.terminal_dest) q.terminal_dest = s.terminal_dest;
  if (s.id) q.id = s.id;
  if (s.id_cliente) q.id_cliente = s.id_cliente;
  if (s.AWB_forn) q.AWB_forn = s.AWB_forn;
  if (s.RIF_cliente) q.RIF_cliente = s.RIF_cliente;
  if (s.note) q.note = s.note;
  if (s.gestione) q.gestione = s.gestione;
  if (s.offerta) q.offerta = s.offerta;
  if (s.tipo_merce) q.tipo_merce = s.tipo_merce;
  if (s.vettore_tipo) q.vettore_tipo = s.vettore_tipo;
  if (s.flight_num1) q.flight_num1 = s.flight_num1;
  if (s.cargo_dazi) q.cargo_dazi = s.cargo_dazi;
  if (s.controllata) q.controllata = s.controllata;
  if (s.archiviata) q.archiviata = s.archiviata;
  if (s.consegna_firma) q.consegna_firma = s.consegna_firma;
  if (s.peso_da) q.peso_da = s.peso_da;
  if (s.peso_a) q.peso_a = s.peso_a;
  if (s.pesor) q.pesor = s.pesor;
  if (s.has_assicurazione) q.has_assicurazione = s.has_assicurazione;
  if (s.acc_dryice) q.acc_dryice = s.acc_dryice;
  if (s.acc_danggoods) q.acc_danggoods = s.acc_danggoods;
  if (s.acc_bancale) q.acc_bancale = s.acc_bancale;
  if (s.chat_unread) q.chat_unread = s.chat_unread;
  return q;
}

function keyOf(q: Record<string, string | number>): string {
  return Object.keys(q)
    .sort()
    .filter((k) => k !== "page" && k !== "per_page")
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

function projectRow(r: ApiRow): CargoListItem {
  return {
    id: r.id,
    cliente: r.cliente,
    consegna_label: r.status?.label,
  };
}

async function fetchPage(page: number): Promise<ApiListResponse | null> {
  try {
    const res = await http<ApiListResponse>("/api_cargo_shipments", {
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
  const state = parseCargoListQuery(routeQuery as Record<string, unknown>);
  if (!cargoListHasActiveFilters(state)) {
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
  options: { overlay?: ComputedRef<boolean> | boolean } = {},
): {
  records: ComputedRef<CargoListItem[]>;
  index: ComputedRef<number>;
  cached: ComputedRef<number>;
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
  const hasNext = computed<boolean>(() => {
    if (index.value < 0) return false;
    if (index.value < cache.value.length - 1) return true;
    return cache.value.length < totalAvailable.value;
  });

  function maybePrefetch(): void {
    if (
      index.value >= cache.value.length - 2 &&
      cache.value.length < totalAvailable.value
    ) {
      void prefetchNextPage();
    }
  }

  /**
   * Push to `/<id>` while preserving the current route's query string
   * so the navigator on the next detail page resolves the same cohort.
   */
  function pushDetail(id: number | string): void {
    const query = { ...router.currentRoute.value.query };
    if (isOverlay()) {
      router.replace({
        name: "cargo-list",
        query: { ...query, view: String(id) },
      });
      return;
    }
    router.push({
      name: "cargo-detail",
      params: { id: String(id) },
      query,
    });
  }

  function goPrev(): void {
    if (!hasPrev.value) return;
    const target = cache.value[index.value - 1];
    if (target) pushDetail(target.id);
  }

  function goNext(): void {
    if (!hasNext.value) return;
    const nextIdx = index.value + 1;
    const target = cache.value[nextIdx];
    if (target) {
      pushDetail(target.id);
      maybePrefetch();
      return;
    }
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
