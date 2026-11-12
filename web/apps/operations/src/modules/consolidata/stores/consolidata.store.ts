/**
 * Store de consolidata: detalle del proyecto abierto y sus vistas
 * (expediciones/reparto, cumplimiento, notas, conversión, historial). El
 * listado vive en consolidata_list.store.ts. Todas las mutaciones
 * pasan por consolidataService; un fallo deja el error normalizado en `error`
 * (la UI lo pinta con ConsolidataApiError) y devuelve `undefined`.
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  consolidataService,
  ConsolidataRequestError,
} from "../services/consolidata.service";
import { isViewMissing } from "../logic";
import {
  type AnswerPayload,
  type ApiMeta,
  type ConsolidataError,
  type ConversionResult,
  type ConversionStep,
  type InternalNote,
  type LegPayload,
  type LogPage,
  type OperateResult,
  type PricePayload,
  type ProjectDetail,
  type Readiness,
  type ShipmentForm,
  type ShipmentsView,
} from "../types";

export const useConsolidataStore = defineStore("consolidata", () => {
  // ── Detalle ───────────────────────────────────────────────
  const project = ref<ProjectDetail | null>(null);
  const shipments = ref<ShipmentsView | null>(null);
  const readiness = ref<Readiness | null>(null);
  const notes = ref<InternalNote[]>([]);
  const conversion = ref<ConversionResult | null>(null);
  const operateResult = ref<OperateResult | null>(null);
  const steps = ref<ConversionStep[] | null>(null);
  /** El API aún no expone view=conversion (o falló): la pestaña lo explica en vez de romperse. */
  const stepsUnavailable = ref(false);
  /** Fallo real (403, 5xx, red) al cargar los pasos: se enseña, no se disfraza de «no disponible». */
  const stepsError = ref<ConsolidataError | null>(null);
  const logPage = ref<LogPage | null>(null);
  const logLoading = ref(false);
  /** Fallo real al cargar el historial paginado (ver stepsError). */
  const logError = ref<ConsolidataError | null>(null);
  const operating = ref(false);
  const meta = ref<ApiMeta | null>(null);
  /** Fallo al cargar `meta`: sin catálogo no se sabe qué botones mostrar, y la página lo dice. */
  const metaError = ref<ConsolidataError | null>(null);
  /**
   * Diálogos abiertos que pintan el error del store ellos mismos. Mientras haya
   * alguno, la página no repite el mismo error (E5).
   */
  const openDialogs = ref(0);
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

  async function fetchMeta(): Promise<void> {
    if (meta.value) return;
    metaError.value = null;
    try {
      meta.value = await consolidataService.meta();
    } catch (err) {
      if (err instanceof ConsolidataRequestError) {
        metaError.value = err.info;
        return;
      }
      throw err;
    }
  }

  // ── Detalle ───────────────────────────────────────────────
  /**
   * Número de la última apertura. Una respuesta lenta del proyecto anterior no debe pisar al actual:
   * cada carga comprueba que el proyecto abierto sigue siendo el suyo (`isCurrent`).
   */
  let openSeq = 0;
  const isCurrent = (id: number): boolean => project.value?.id === id;

  async function openProject(id: number): Promise<void> {
    const seq = ++openSeq;
    detailLoading.value = true;
    project.value = null;
    shipments.value = null;
    readiness.value = null;
    notes.value = [];
    conversion.value = null;
    operateResult.value = null;
    steps.value = null;
    stepsUnavailable.value = false;
    stepsError.value = null;
    logPage.value = null;
    logError.value = null;
    try {
      const res = await run(() => consolidataService.detail(id));
      if (seq !== openSeq) return;
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
      if (seq === openSeq) detailLoading.value = false;
    }
  }

  async function loadShipments(): Promise<void> {
    if (!project.value) return;
    const id = project.value.id;
    const res = await run(() => consolidataService.shipments(id));
    if (res && isCurrent(id)) shipments.value = res;
  }

  async function loadReadiness(): Promise<void> {
    if (!project.value) return;
    const id = project.value.id;
    const res = await run(() => consolidataService.readiness(id));
    if (res && isCurrent(id)) readiness.value = res;
  }

  async function loadNotes(): Promise<void> {
    if (!project.value) return;
    const id = project.value.id;
    const res = await run(() => consolidataService.notes(id));
    if (res && isCurrent(id)) notes.value = res.note;
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
    idProgSped: number | null,
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

  /** Staff: completa el perfil de una house. Cambia el cumplimiento (avisos de datos que faltan), no la cabecera. */
  async function updateProfile(
    idSped: number,
    profilo: Record<string, string>,
  ): Promise<boolean> {
    const res = await mutate(() =>
      consolidataService.updateProfile(pid(), idSped, profilo),
    );
    if (!res) return false;
    shipments.value = res;
    await loadReadiness();
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
    const id = project.value.id;
    const res = await run(() => consolidataService.detail(id));
    if (res && isCurrent(id)) project.value = res;
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

  const addLeg = async (leg: LegPayload): Promise<boolean> =>
    adopt(await mutate(() => consolidataService.addLeg(pid(), leg)));
  const removeLeg = async (idTratta: number): Promise<boolean> =>
    adopt(await mutate(() => consolidataService.removeLeg(pid(), idTratta)));
  const setEori = async (eori: string): Promise<boolean> =>
    adopt(await mutate(() => consolidataService.setEori(pid(), eori)));
  const requestQuote = async (): Promise<boolean> =>
    adopt(await mutate(() => consolidataService.requestQuote(pid())));

  /**
   * Pasos de conversión (view=conversion). Sin la vista en el API (400/404/405/501) queda `stepsUnavailable`;
   * cualquier otro fallo queda en `stepsError`. Ninguno toca `error`.
   */
  async function loadSteps(): Promise<void> {
    if (!project.value) return;
    const id = project.value.id;
    try {
      const res = await consolidataService.conversion(id);
      if (!isCurrent(id)) return;
      steps.value = Array.isArray(res.passi) ? res.passi : [];
      stepsUnavailable.value = false;
      stepsError.value = null;
    } catch (err) {
      if (!(err instanceof ConsolidataRequestError)) throw err;
      if (!isCurrent(id)) return;
      steps.value = null;
      stepsUnavailable.value = isViewMissing(err.info);
      stepsError.value = stepsUnavailable.value ? null : err.info;
    }
  }

  /**
   * Historial paginado (view=log). Sin la vista en el API (400/404/405/501) se cae al `log` del detalle;
   * cualquier otro fallo queda en `logError` y la pestaña lo enseña.
   */
  async function loadLog(pageNo = 1, perPage = 20): Promise<void> {
    if (!project.value) return;
    const id = project.value.id;
    logLoading.value = true;
    logError.value = null;
    try {
      const res = await consolidataService.log(id, pageNo, perPage);
      if (isCurrent(id)) logPage.value = res;
    } catch (err) {
      if (!(err instanceof ConsolidataRequestError)) throw err;
      if (!isCurrent(id)) return;
      if (!isViewMissing(err.info)) {
        logError.value = err.info;
        return;
      }
      const rows = project.value?.log ?? [];
      logPage.value = {
        items: rows,
        count: rows.length,
        current_page: 1,
        max_page: 1,
        per_page: rows.length || perPage,
      };
    } finally {
      logLoading.value = false;
    }
  }

  /**
   * `operate`: conversión completa. `operating` bloquea el botón durante la
   * llamada (evita el doble clic); tras responder se recargan cabecera y pasos.
   */
  async function operate(opts: {
    id_cargo?: number | null;
    reservar?: boolean;
  }): Promise<OperateResult | undefined> {
    if (operating.value) return undefined;
    operating.value = true;
    try {
      const res = await mutate(() => consolidataService.operate(pid(), opts));
      // El refresco limpia `error` (run): se guarda el de operate para que se vea (409, timeout del BFF…).
      const failed = error.value;
      if (res) operateResult.value = res;
      await Promise.all([refreshProject(), loadSteps()]);
      if (failed) error.value = failed;
      return res;
    } finally {
      operating.value = false;
    }
  }

  return {
    project,
    shipments,
    readiness,
    notes,
    conversion,
    operateResult,
    steps,
    stepsUnavailable,
    stepsError,
    logPage,
    logLoading,
    logError,
    operating,
    meta,
    metaError,
    openDialogs,
    actions,
    detailLoading,
    saving,
    error,
    clearError,
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
    updateProfile,
    removeShipment,
    convert,
    refreshProject,
    addLeg,
    removeLeg,
    setEori,
    requestQuote,
    loadSteps,
    loadLog,
    operate,
  };
});
