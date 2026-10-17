import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  numberingService,
  type NumberingEngine,
  type NumberingEngineInput,
  type NumberingCounter,
  type NumberingAuditRow,
  type NumberingTipo,
} from "../services/numbering.service";
import { useToastStore } from "./toast.store";
import { isAbortLikeError } from "@tmwe/shared-frontend/http";

/**
 * Estado de los motores de numeración (pantalla de configuración).
 *
 * El detalle (contadores + auditoría) se carga bajo demanda al expandir una
 * fila: son dos llamadas extra por motor y casi nunca se miran todas.
 */
export const useNumberingStore = defineStore("numbering", () => {
  const engines = ref<NumberingEngine[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  /** Detalle por motor, cacheado tras la primera expansión. */
  const counters = ref<Record<number, NumberingCounter[]>>({});
  const audits = ref<Record<number, NumberingAuditRow[]>>({});
  const loadingDetail = ref<Record<number, boolean>>({});

  const toasts = useToastStore();
  let ctrl: AbortController | null = null;

  const activas = computed(() =>
    engines.value.filter((e) => e.tipo_fattura === "A"),
  );
  const pasivas = computed(() =>
    engines.value.filter((e) => e.tipo_fattura === "P"),
  );

  /** Periodos con huecos: emitidos < esperados. Alimenta el aviso fiscal. */
  const seriesConHuecos = computed(() => {
    const out: Array<{ engine: NumberingEngine; row: NumberingAuditRow }> = [];
    for (const e of engines.value) {
      for (const row of audits.value[e.id] ?? []) {
        if (row.emitidos < row.esperados) out.push({ engine: e, row });
      }
    }
    return out;
  });

  async function load(tipo?: NumberingTipo): Promise<void> {
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    loading.value = true;
    error.value = null;
    try {
      const rows = await numberingService.list(tipo, signal);
      // ofetch envuelve abortos en FetchError → detectar por signal.aborted.
      if (signal.aborted) return;
      engines.value = rows;
    } catch (e) {
      if (isAbortLikeError(e, signal)) return;
      error.value = String(e);
      toasts.push("error", "No se pudieron cargar los motores de numeración");
    } finally {
      if (!signal.aborted) loading.value = false;
    }
  }

  /** Contadores + auditoría de un motor. Idempotente: no recarga si ya están. */
  async function loadDetail(id: number, force = false): Promise<void> {
    if (!force && counters.value[id]) return;
    loadingDetail.value = { ...loadingDetail.value, [id]: true };
    try {
      const [c, a] = await Promise.all([
        numberingService.counters(id),
        numberingService.audit(id).catch(() => [] as NumberingAuditRow[]),
      ]);
      counters.value = { ...counters.value, [id]: c };
      audits.value = { ...audits.value, [id]: a };
    } catch (e) {
      toasts.push("error", String(e));
    } finally {
      loadingDetail.value = { ...loadingDetail.value, [id]: false };
    }
  }

  async function create(
    input: NumberingEngineInput,
  ): Promise<NumberingEngine | null> {
    saving.value = true;
    try {
      const created = await numberingService.create(input);
      toasts.push("success", "Motor de numeración creado");
      await load();
      return created;
    } catch (e) {
      toasts.push("error", String(e));
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function update(
    id: number,
    input: Partial<NumberingEngineInput>,
  ): Promise<boolean> {
    saving.value = true;
    try {
      await numberingService.update(id, input);
      toasts.push("success", "Motor actualizado");
      await load();
      // El detalle puede haber cambiado (p.ej. valore_inicial).
      if (counters.value[id]) await loadDetail(id, true);
      return true;
    } catch (e) {
      toasts.push("error", String(e));
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function remove(id: number): Promise<boolean> {
    saving.value = true;
    try {
      const res = await numberingService.remove(id);
      // Un motor con facturas emitidas se desactiva pero conserva su serie:
      // hay que poder auditarla aunque ya no se use.
      toasts.push(
        "success",
        res.facturas_emitidas > 0
          ? `Motor desactivado. Conserva ${res.facturas_emitidas} números emitidos.`
          : "Motor eliminado",
      );
      await load();
      return true;
    } catch (e) {
      toasts.push("error", String(e));
      return false;
    } finally {
      saving.value = false;
    }
  }

  function reset(): void {
    ctrl?.abort();
    engines.value = [];
    counters.value = {};
    audits.value = {};
    error.value = null;
  }

  return {
    engines,
    loading,
    saving,
    error,
    counters,
    audits,
    loadingDetail,
    activas,
    pasivas,
    seriesConHuecos,
    load,
    loadDetail,
    create,
    update,
    remove,
    reset,
  };
});
