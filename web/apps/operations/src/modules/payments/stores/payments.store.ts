import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { isAbortLikeError } from "@tmwe/shared-frontend/http";
import { paymentsApi } from "../services/payments.service";
import { useToastStore } from "./toast.store";
import {
  OPEN_DATE,
  type PaymentFilters,
  type PaymentMethod,
  type PaymentRow,
  type PaymentSortKey,
} from "../types";

/** Vistas del listado: deuda (a pagar), crédito (a cobrar) y vencidas. */
export type PaymentView = "debit" | "credit" | "overdue";

/** Filtros efectivos que se mandan a la API según la vista elegida. */
export function effectiveFilters(
  view: PaymentView,
  filters: PaymentFilters,
): PaymentFilters {
  const f: PaymentFilters = { ...filters };
  if (view === "debit") f.tipo = "P";
  else if (view === "credit") {
    f.tipo = "A";
    // «A cobrar» = solo cuotas abiertas, salvo que el usuario elija otro estado.
    if (!f.statop) f.statop = "O";
  } else {
    // Vencidas: solo cobros (tipo A); el filtro de días (10/30) se conserva.
    f.tipo = "A";
    if (f.statop !== "10" && f.statop !== "30") f.statop = "SC";
  }
  return f;
}

export function isOpenRow(r: Pick<PaymentRow, "data_close">): boolean {
  return !r.data_close || r.data_close === OPEN_DATE;
}

export const usePaymentsStore = defineStore("payments", () => {
  const view = ref<PaymentView>("credit");
  const filters = ref<PaymentFilters>({});
  const rows = ref<PaymentRow[]>([]);
  const total = ref(0);
  const totalAmount = ref(0);
  const page = ref(1);
  const perPage = ref(25);
  const sort = ref<PaymentSortKey>("scadenza");
  const sortDir = ref<"ASC" | "DESC">("ASC");
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selected = ref<number[]>([]);
  const methods = ref<PaymentMethod[]>([]);

  const toasts = useToastStore();
  let ctrl: AbortController | null = null;

  const query = computed(() => effectiveFilters(view.value, filters.value));
  const selectedRows = computed(() =>
    rows.value.filter((r) => selected.value.includes(r.id)),
  );
  const selectedAmount = computed(() =>
    selectedRows.value.reduce((s, r) => s + r.importo, 0),
  );

  async function load(): Promise<void> {
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    loading.value = true;
    error.value = null;
    try {
      const res = await paymentsApi.list(
        query.value,
        {
          page: page.value,
          perPage: perPage.value,
          sort: sort.value,
          sortDir: sortDir.value,
        },
        signal,
      );
      if (signal.aborted) return;
      rows.value = res.rows;
      total.value = res.total;
      totalAmount.value = res.totalAmount;
      // La selección solo conserva filas todavía visibles y abiertas.
      selected.value = selected.value.filter((id) =>
        res.rows.some((r) => r.id === id && isOpenRow(r)),
      );
    } catch (e) {
      if (isAbortLikeError(e, signal)) return;
      error.value = "load_failed";
      rows.value = [];
      total.value = 0;
      totalAmount.value = 0;
    } finally {
      if (!signal.aborted) loading.value = false;
    }
  }

  function setView(v: PaymentView): void {
    view.value = v;
    page.value = 1;
    selected.value = [];
    void load();
  }

  function setFilters(patch: Partial<PaymentFilters>): void {
    filters.value = { ...filters.value, ...patch };
    page.value = 1;
    selected.value = [];
    void load();
  }

  function resetFilters(): void {
    filters.value = {};
    page.value = 1;
    selected.value = [];
    void load();
  }

  function setPage(p: number): void {
    page.value = p;
    void load();
  }

  function setPerPage(n: number): void {
    perPage.value = n;
    page.value = 1;
    void load();
  }

  function setSort(key: PaymentSortKey, dir: "ASC" | "DESC"): void {
    sort.value = key;
    sortDir.value = dir;
    page.value = 1;
    void load();
  }

  function setSelected(ids: number[]): void {
    selected.value = ids;
  }

  async function loadMethods(): Promise<void> {
    if (methods.value.length) return;
    try {
      methods.value = await paymentsApi.methods();
    } catch {
      methods.value = [];
    }
  }

  async function reopen(id: number): Promise<boolean> {
    try {
      await paymentsApi.reopen(id);
      return true;
    } catch (e) {
      toasts.push("error", String(e instanceof Error ? e.message : e));
      return false;
    }
  }

  return {
    view,
    filters,
    rows,
    total,
    totalAmount,
    page,
    perPage,
    sort,
    sortDir,
    loading,
    error,
    selected,
    selectedRows,
    selectedAmount,
    methods,
    query,
    load,
    setView,
    setFilters,
    resetFilters,
    setPage,
    setPerPage,
    setSort,
    setSelected,
    loadMethods,
    reopen,
  };
});
