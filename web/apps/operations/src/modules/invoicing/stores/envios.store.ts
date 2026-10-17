import { defineStore } from "pinia";
import { ref } from "vue";
import { isAbortLikeError } from "@tmwe/shared-frontend/http";
import {
  enviosService,
  ENVIOS_TABS,
  type EnvioDetail,
  type EnvioRow,
  type EnviosCounters,
  type EnviosFilters,
  type EnviosTab,
  type SendResult,
  type ReceiptResult,
} from "../services/envios.service";
import { downloadBase64 } from "../services/einvoice.service";
import { useToastStore } from "./toast.store";

function emptyCounters(): EnviosCounters {
  return ENVIOS_TABS.reduce(
    (acc, tab) => ({ ...acc, [tab]: 0 }),
    {} as EnviosCounters,
  );
}

/**
 * Estado de la página «Envíos al Estado»: pestaña activa, filtros,
 * paginación, contadores y acciones (enviar, reintentar, cargar acuse).
 * Tras cada acción se recarga la pestaña: el estado lo decide el backend
 * (solo cambia con un acuse, DISENO §7.0.3).
 */
export const useEnviosStore = defineStore("invoicing-envios", () => {
  const tab = ref<EnviosTab>("listas");
  const filters = ref<EnviosFilters>({ vence: "" });
  const page = ref(1);
  const perPage = ref(25);
  const items = ref<EnvioRow[]>([]);
  const total = ref(0);
  const counters = ref<EnviosCounters>(emptyCounters());
  const puedeEnviar = ref(false);
  const esTmwe = ref(false);
  const loading = ref(false);
  const working = ref(false);
  const error = ref<string | null>(null);
  const selected = ref<number[]>([]);

  const toasts = useToastStore();
  let ctrl: AbortController | null = null;

  async function load(): Promise<void> {
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    loading.value = true;
    error.value = null;
    try {
      const res = await enviosService.list(
        tab.value,
        filters.value,
        page.value,
        perPage.value,
        signal,
      );
      if (signal.aborted) return;
      items.value = res.items;
      total.value = res.total;
      counters.value = { ...emptyCounters(), ...res.counters };
      puedeEnviar.value = res.puedeEnviar;
      esTmwe.value = res.esTmwe;
      selected.value = selected.value.filter((id) =>
        res.items.some((r) => r.id === id),
      );
    } catch (e) {
      if (isAbortLikeError(e, signal)) return;
      error.value = String(e);
    } finally {
      if (!signal.aborted) loading.value = false;
    }
  }

  function setTab(next: EnviosTab): void {
    if (tab.value === next) return;
    tab.value = next;
    page.value = 1;
    selected.value = [];
    void load();
  }

  function applyFilters(next: EnviosFilters): void {
    filters.value = { ...next };
    page.value = 1;
    void load();
  }

  /** Envío individual o por lotes. Devuelve los resultados por envío. */
  async function send(ids: number[]): Promise<SendResult[]> {
    if (ids.length === 0) return [];
    working.value = true;
    try {
      const res = await enviosService.send(ids);
      selected.value = [];
      await load();
      return res.resultados;
    } catch (e) {
      toasts.push("error", String(e));
      return [];
    } finally {
      working.value = false;
    }
  }

  async function retry(id: number): Promise<SendResult | null> {
    working.value = true;
    try {
      const res = await enviosService.retry(id);
      await load();
      return res;
    } catch (e) {
      toasts.push("error", String(e));
      return null;
    } finally {
      working.value = false;
    }
  }

  async function uploadReceipt(
    id: number,
    filename: string,
    contentBase64: string,
    resultado?: "ACEPTADA" | "RECHAZADA",
  ): Promise<ReceiptResult | null> {
    working.value = true;
    try {
      const res = await enviosService.uploadReceipt(
        id,
        filename,
        contentBase64,
        resultado,
      );
      await load();
      return res;
    } catch (e) {
      toasts.push("error", String(e));
      return null;
    } finally {
      working.value = false;
    }
  }

  async function downloadFile(id: number): Promise<void> {
    try {
      const f = await enviosService.file(id);
      downloadBase64(f.content_base64, f.filename, f.mime);
    } catch (e) {
      toasts.push("error", String(e));
    }
  }

  async function downloadReceipt(idAcuse: number): Promise<void> {
    try {
      const f = await enviosService.receipt(idAcuse);
      downloadBase64(f.content_base64, f.filename, f.mime);
    } catch (e) {
      toasts.push("error", String(e));
    }
  }

  async function detail(id: number): Promise<EnvioDetail | null> {
    try {
      return await enviosService.detail(id);
    } catch (e) {
      toasts.push("error", String(e));
      return null;
    }
  }

  function reset(): void {
    ctrl?.abort();
    items.value = [];
    total.value = 0;
    selected.value = [];
    error.value = null;
  }

  return {
    tab,
    filters,
    page,
    perPage,
    items,
    total,
    counters,
    puedeEnviar,
    esTmwe,
    loading,
    working,
    error,
    selected,
    load,
    setTab,
    applyFilters,
    send,
    retry,
    uploadReceipt,
    downloadFile,
    downloadReceipt,
    detail,
    reset,
  };
});
