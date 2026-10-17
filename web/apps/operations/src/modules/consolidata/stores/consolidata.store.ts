/**
 * Store de consolidata: bandeja del staff, detalle del proyecto abierto y sus
 * vistas (expediciones/reparto, cumplimiento, notas). Todas las mutaciones
 * pasan por consolidataService; un fallo deja el error normalizado en `error`
 * (la UI lo pinta con ConsolidataApiError) y devuelve `undefined`.
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  consolidataService,
  ConsolidataRequestError,
} from "../services/consolidata.service";
import {
  type AnswerPayload,
  type ApiMeta,
  type ConsolidataError,
  type ConversionResult,
  type InternalNote,
  type PricePayload,
  type ProjectDetail,
  type QueueFilters,
  type QueueItem,
  type Readiness,
  type ShipmentForm,
  type ShipmentsView,
  emptyQueueFilters,
} from "../types";

export const useConsolidataStore = defineStore("consolidata", () => {
  // ── Bandeja ───────────────────────────────────────────────
  const items = ref<QueueItem[]>([]);
  const count = ref(0);
  const page = ref(1);
  const maxPage = ref(1);
  const filters = ref<QueueFilters>(emptyQueueFilters());
  const loading = ref(false);

  // ── Detalle ───────────────────────────────────────────────
  const project = ref<ProjectDetail | null>(null);
  const shipments = ref<ShipmentsView | null>(null);
  const readiness = ref<Readiness | null>(null);
  const notes = ref<InternalNote[]>([]);
  const conversion = ref<ConversionResult | null>(null);
  const meta = ref<ApiMeta | null>(null);
  const detailLoading = ref(false);
  const saving = ref(false);

  const error = ref<ConsolidataError | null>(null);

  const actions = computed(() => meta.value?.actions ?? null);

  function clearError(): void {
    error.value = null;
  }

  /** Ejecuta una llamada; en fallo guarda el error normalizado y devuelve undefined. */
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    error.value = null;
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ConsolidataRequestError) {
        error.value = err.info;
        return undefined;
      }
      throw err;
    }
  }

  async function mutate<T>(fn: () => Promise<T>): Promise<T | undefined> {
    saving.value = true;
    try {
      return await run(fn);
    } finally {
      saving.value = false;
    }
  }

  // ── Bandeja ───────────────────────────────────────────────
  async function fetchQueue(): Promise<void> {
    loading.value = true;
    try {
      const res = await run(() =>
        consolidataService.queue(filters.value, page.value),
      );
      if (res) {
        items.value = res.items;
        count.value = res.count;
        page.value = res.current_page;
        maxPage.value = res.max_page;
      }
    } finally {
      loading.value = false;
    }
  }

  function setFilters(next: QueueFilters): void {
    filters.value = next;
    page.value = 1;
  }

  async function fetchMeta(): Promise<void> {
    if (meta.value) return;
    const res = await run(() => consolidataService.meta());
    if (res) meta.value = res;
  }

  // ── Detalle ───────────────────────────────────────────────
  async function openProject(id: number): Promise<void> {
    detailLoading.value = true;
    project.value = null;
    shipments.value = null;
    readiness.value = null;
    notes.value = [];
    conversion.value = null;
    try {
      const res = await run(() => consolidataService.detail(id));
      if (res) {
        project.value = res;
        await Promise.all([
          loadShipments(),
          loadReadiness(),
          loadNotes(),
          fetchMeta(),
        ]);
      }
    } finally {
      detailLoading.value = false;
    }
  }

  async function loadShipments(): Promise<void> {
    if (!project.value) return;
    const res = await run(() =>
      consolidataService.shipments(project.value!.id),
    );
    if (res) shipments.value = res;
  }

  async function loadReadiness(): Promise<void> {
    if (!project.value) return;
    const res = await run(() =>
      consolidataService.readiness(project.value!.id),
    );
    if (res) readiness.value = res;
  }

  async function loadNotes(): Promise<void> {
    if (!project.value) return;
    const res = await run(() => consolidataService.notes(project.value!.id));
    if (res) notes.value = res.note;
  }

  /** Tras una mutación que devuelve el detalle: lo adopta y refresca vistas derivadas. */
  async function adopt(detail: ProjectDetail | undefined): Promise<boolean> {
    if (!detail) return false;
    project.value = detail;
    await Promise.all([loadShipments(), loadReadiness()]);
    return true;
  }

  const pid = (): number => project.value!.id;

  const take = async (): Promise<boolean> =>
    adopt(await mutate(() => consolidataService.take(pid())));
  const assign = async (userId: number): Promise<boolean> =>
    adopt(await mutate(() => consolidataService.assign(pid(), userId)));
  const answerQuote = async (a: AnswerPayload): Promise<boolean> =>
    adopt(await mutate(() => consolidataService.answerQuote(pid(), a)));
  const overridePrice = async (
    idTratta: number,
    p: PricePayload,
  ): Promise<boolean> =>
    adopt(
      await mutate(() => consolidataService.overridePrice(pid(), idTratta, p)),
    );
  const recalc = async (): Promise<boolean> =>
    adopt(await mutate(() => consolidataService.recalc(pid())));
  const updateLeg = async (
    idTratta: number,
    leg: Record<string, unknown>,
  ): Promise<boolean> =>
    adopt(
      await mutate(() => consolidataService.updateLeg(pid(), idTratta, leg)),
    );
  const setState = async (
    action: "close" | "reopen" | "cancel",
  ): Promise<boolean> =>
    adopt(await mutate(() => consolidataService[action](pid())));

  async function addNote(nota: string): Promise<boolean> {
    const res = await mutate(() =>
      consolidataService.noteInternal(pid(), nota),
    );
    if (!res) return false;
    notes.value = res.note;
    return true;
  }

  async function waive(
    codice: string,
    idProgSped: number,
    motivo: string,
  ): Promise<boolean> {
    const res = await mutate(() =>
      consolidataService.waiveWarning(pid(), codice, idProgSped, motivo),
    );
    if (!res) return false;
    await loadReadiness();
    return true;
  }

  async function saveShipment(
    form: ShipmentForm,
    idSped: number | null,
  ): Promise<boolean> {
    const res = await mutate(() =>
      idSped === null
        ? consolidataService.addShipment(pid(), form)
        : consolidataService.updateShipment(pid(), idSped, form),
    );
    if (!res) return false;
    shipments.value = res;
    await refreshProject();
    return true;
  }

  async function removeShipment(idSped: number): Promise<boolean> {
    const res = await mutate(() =>
      consolidataService.removeShipment(pid(), idSped),
    );
    if (!res) return false;
    shipments.value = res;
    await refreshProject();
    return true;
  }

  /** Recarga cabecera y cumplimiento (un cambio de expediciones puede devolver P→A). */
  async function refreshProject(): Promise<void> {
    if (!project.value) return;
    const res = await run(() => consolidataService.detail(project.value!.id));
    if (res) project.value = res;
    await loadReadiness();
  }

  async function convert(
    idCargo: number,
  ): Promise<ConversionResult | undefined> {
    const res = await mutate(() => consolidataService.convert(pid(), idCargo));
    if (res) {
      conversion.value = res;
      await refreshProject();
    }
    return res;
  }

  return {
    items,
    count,
    page,
    maxPage,
    filters,
    loading,
    project,
    shipments,
    readiness,
    notes,
    conversion,
    meta,
    actions,
    detailLoading,
    saving,
    error,
    clearError,
    fetchQueue,
    setFilters,
    fetchMeta,
    openProject,
    loadShipments,
    loadReadiness,
    loadNotes,
    take,
    assign,
    answerQuote,
    overridePrice,
    recalc,
    updateLeg,
    setState,
    addNote,
    waive,
    saveShipment,
    removeShipment,
    convert,
    refreshProject,
  };
});
