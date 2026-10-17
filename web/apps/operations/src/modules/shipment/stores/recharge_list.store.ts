import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { isAbortLikeError, toUserMessage } from "@tmwe/shared-frontend/http";
import {
  rechargeService,
  type RechargeListRow,
  type RechargeView,
} from "@shipment/services/recharge.service";
import { i18n } from "@shipment/plugins/i18n";

/**
 * Store del listado de postfacturación (riaddebito) — réplica moderna de la
 * lista legacy `winbody.php?pp=spedy&tiz=faddebit2`.
 *
 * Dos vistas (decisión 3 del plan de paridad):
 *   - to_apply  : controllo_fatt='CA' (ya marcadas, listas para aplicar)
 *   - faddebit2 : controllo_fatt='NO', archiviata='N' (control pendiente —
 *                 la vista legacy "addebito differenze del corriere")
 *
 * Sigue el patrón de shipment_list.store.ts: state + fetchPage + refresh +
 * AbortController para cancelación en vuelo.
 */

export interface RechargeListUrlState {
  page: number;
  per_page: number;
  view: RechargeView; // 'to_apply' | 'faddebit2'
  date_from: string;
  date_to: string;
  id_fornitore: string;
  id_cliente: string;
}

export const RECHARGE_LIST_DEFAULTS: RechargeListUrlState = {
  page: 1,
  per_page: 25,
  view: "faddebit2",
  date_from: "",
  date_to: "",
  id_fornitore: "",
  id_cliente: "",
};

const VALID_VIEWS: RechargeView[] = ["to_apply", "faddebit2"];

/** route.query → estado validado (deep-linking). */
export function parseRechargeListQuery(
  q: Record<string, unknown>,
): RechargeListUrlState {
  const s: RechargeListUrlState = { ...RECHARGE_LIST_DEFAULTS };
  const view = String(q.view ?? "");
  if ((VALID_VIEWS as string[]).includes(view)) s.view = view as RechargeView;
  const page = parseInt(String(q.page ?? ""), 10);
  if (Number.isFinite(page) && page > 0) s.page = page;
  const pp = parseInt(String(q.per_page ?? ""), 10);
  if (Number.isFinite(pp) && pp > 0) s.per_page = pp;
  if (q.date_from) s.date_from = String(q.date_from);
  if (q.date_to) s.date_to = String(q.date_to);
  if (q.id_fornitore) s.id_fornitore = String(q.id_fornitore);
  if (q.id_cliente) s.id_cliente = String(q.id_cliente);
  return s;
}

/** estado → query params (solo no-default). */
export function serializeRechargeListQuery(
  s: RechargeListUrlState,
): Record<string, string> {
  const out: Record<string, string> = {};
  (
    Object.keys(RECHARGE_LIST_DEFAULTS) as Array<keyof RechargeListUrlState>
  ).forEach((k) => {
    const v = s[k];
    if (v !== RECHARGE_LIST_DEFAULTS[k] && v !== "") out[k] = String(v);
  });
  return out;
}

export const useRechargeListStore = defineStore("recharge_list", () => {
  const state = ref<RechargeListUrlState>({ ...RECHARGE_LIST_DEFAULTS });
  const rows = ref<RechargeListRow[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let controller: AbortController | null = null;

  const hasActiveFilters = computed<boolean>(
    () =>
      !!(
        state.value.date_from ||
        state.value.date_to ||
        state.value.id_fornitore ||
        state.value.id_cliente
      ),
  );

  function applyState(next: Partial<RechargeListUrlState>): void {
    state.value = { ...state.value, ...next };
  }

  async function fetchPage(append = false): Promise<void> {
    if (controller) controller.abort();
    // Local handle: `controller` is reassigned by the next call, so a late
    // catch/finally must check ITS OWN signal, not whatever is current.
    const myController = new AbortController();
    controller = myController;
    loading.value = true;
    error.value = null;

    const s = state.value;
    const filters: {
      date_from?: string;
      date_to?: string;
      id_fornitore?: number;
      id_cliente?: number;
    } = {};
    if (s.date_from) filters.date_from = s.date_from;
    if (s.date_to) filters.date_to = s.date_to;
    if (s.id_fornitore) filters.id_fornitore = Number(s.id_fornitore);
    if (s.id_cliente) filters.id_cliente = Number(s.id_cliente);

    try {
      const r = await rechargeService.pending(
        s.view,
        s.page,
        s.per_page,
        filters,
        { signal: myController.signal },
      );
      if (r.success && Array.isArray(r.data)) {
        rows.value = append ? [...rows.value, ...r.data] : r.data;
        total.value = r.total ?? r.data.length;
      } else {
        error.value = r.error ?? "Errore caricamento postfatturazione";
        if (!append) {
          rows.value = [];
          total.value = 0;
        }
      }
    } catch (err) {
      // ofetch wraps aborts in a FetchError, so the old `err.name ===
      // "AbortError"` check never matched and cancelled requests surfaced as
      // errors. isAbortLikeError checks the signal (and page unload) instead.
      if (isAbortLikeError(err, myController.signal)) return;
      error.value = toUserMessage(err, i18n.global.t("listing.error.network"));
    } finally {
      // Only the *current* request may clear the spinner.
      if (controller === myController) loading.value = false;
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

  function loadPage(page: number): Promise<void> {
    state.value.page = page;
    return fetchPage(false);
  }

  function setPerPage(n: number): void {
    state.value.per_page = n;
    state.value.page = 1;
  }

  function reset(): void {
    state.value = { ...RECHARGE_LIST_DEFAULTS };
  }

  return {
    state,
    rows,
    total,
    loading,
    error,
    hasActiveFilters,
    applyState,
    fetchPage,
    refresh,
    loadMore,
    loadPage,
    setPerPage,
    reset,
  };
});
