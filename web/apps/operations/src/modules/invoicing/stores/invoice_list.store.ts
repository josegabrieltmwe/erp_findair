import { defineStore } from "pinia";
import { ref } from "vue";
import {
  invoiceService,
  type InvoiceListItem,
  type InvoiceListFilters,
} from "../services/invoice.service";
import {
  supplierInvoiceApi,
  type SupplierListFilters,
} from "../services/supplierInvoice.service";
import { useToastStore } from "./toast.store";
import { isAbortLikeError } from "@tmwe/shared-frontend/http";

/**
 * Store del listado de facturas. Implementa el contrato `ListSource` de
 * `packages/platform/listing` (mismo patrón que cargo_list / shipment_list)
 * para alimentar `ListingDataView` en sus DOS modos:
 *   - paginado clásico (loadPage)
 *   - scroll infinito (loadMore, acumulando filas con `append`)
 * El estado de filtros se mantiene aparte y resetea a página 1 al cambiar.
 */
/** Filtros que entiende el listado de recibidas (sin tipo_fattura ni orden). */
export function supplierFilters(
  f: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...f };
  delete out.tipo_fattura;
  delete out.sort;
  delete out.sort_dir;
  return out;
}

export const useInvoiceListStore = defineStore("invoice_list", () => {
  // Estado expuesto al contrato ListSource.
  const rows = ref<InvoiceListItem[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const page = ref(1);
  const perPage = ref(25);
  const sort = ref("");
  const sortDir = ref<"ASC" | "DESC">("DESC");

  // Filtros del drawer (data_da/data_a/numero/stato_sdi/tipo_fattura/...).
  const filters = ref<
    Omit<InvoiceListFilters, "page" | "per_page" | "sort" | "sort_dir">
  >({});

  /** A = emitidas, P = recibidas (de proveedor). */
  const tab = ref<"A" | "P">("A");

  const toasts = useToastStore();
  let ctrl: AbortController | null = null;

  /**
   * Carga una página. Con `append=true` (scroll infinito) acumula las filas
   * nuevas; sin él (paginado / refresh) las reemplaza.
   */
  async function fetchPage(append = false): Promise<void> {
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    loading.value = true;
    error.value = null;
    try {
      const res =
        tab.value === "P"
          ? await supplierInvoiceApi.list(
              {
                ...(supplierFilters(filters.value) as SupplierListFilters),
                page: page.value,
                per_page: perPage.value,
              },
              signal,
            )
          : await invoiceService.list(
              {
                ...filters.value,
                page: page.value,
                per_page: perPage.value,
                sort: sort.value || undefined,
                sort_dir: sortDir.value,
              },
              signal,
            );
      // ofetch envuelve los abortos: comprobar la señal, no err.name.
      if (signal.aborted) return;
      const incoming = (res.items ?? []) as InvoiceListItem[];
      rows.value = append ? [...rows.value, ...incoming] : incoming;
      total.value = res.total ?? rows.value.length;
    } catch (e) {
      if (isAbortLikeError(e, signal)) return;
      error.value = "load_failed";
      if (!append) {
        rows.value = [];
        total.value = 0;
      }
      toasts.push("error", "No se pudo cargar el listado");
    } finally {
      if (!signal.aborted) loading.value = false;
    }
  }

  // ── Contrato ListSource ──────────────────────────────────────────────
  async function loadPage(p: number): Promise<void> {
    page.value = p;
    await fetchPage(false);
  }

  async function loadMore(): Promise<void> {
    if (loading.value || rows.value.length >= total.value) return;
    page.value += 1;
    await fetchPage(true);
  }

  async function refresh(): Promise<void> {
    page.value = 1;
    await fetchPage(false);
  }

  function setSort(s: string, dir: "ASC" | "DESC"): void {
    sort.value = s;
    sortDir.value = dir;
    page.value = 1;
    void fetchPage(false);
  }

  function setPerPage(n: number): void {
    perPage.value = n;
    page.value = 1;
    void fetchPage(false);
  }

  // ── API para los filtros del drawer ──────────────────────────────────
  function setFilters(patch: Partial<InvoiceListFilters>): void {
    const { per_page: pp, ...rest } = patch;
    // Solo conservar los campos de filtro (no page/sort/sort_dir).
    delete (rest as Record<string, unknown>).page;
    delete (rest as Record<string, unknown>).sort;
    delete (rest as Record<string, unknown>).sort_dir;
    filters.value = { ...filters.value, ...rest };
    if (typeof pp === "number") perPage.value = pp;
    page.value = 1;
    void fetchPage(false);
  }

  /** Cambia entre emitidas y recibidas; los filtros no se comparten. */
  function setTab(next: "A" | "P"): void {
    if (tab.value === next && rows.value.length) return;
    tab.value = next;
    filters.value = {};
    sort.value = "";
    page.value = 1;
    void fetchPage(false);
  }

  // Compat: arranque inicial.
  async function fetch(): Promise<void> {
    page.value = 1;
    await fetchPage(false);
  }

  return {
    // estado (ListSource)
    rows,
    total,
    loading,
    error,
    page,
    perPage,
    sort,
    sortDir,
    // filtros
    tab,
    setTab,
    filters,
    // métodos (ListSource)
    loadPage,
    loadMore,
    refresh,
    setSort,
    setPerPage,
    // app
    setFilters,
    fetch,
  };
});
