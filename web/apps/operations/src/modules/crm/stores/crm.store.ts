import { defineStore } from "pinia";
import { ref } from "vue";

import {
  crmService,
  type CrmListFilters,
  type CrmListSort,
} from "../services/crm.service";
import type {
  CrmPratica,
  CrmEvento,
  CrmMessaggio,
  CrmTipo,
  CrmListShortcut,
  StatoPratica,
  SendMessagePayload,
  CrmEventoUpdate,
} from "../types";

export type CrmDetailLoadState = "ready" | "partial" | "error" | "stale";

export interface CrmDetailLoadResult {
  state: CrmDetailLoadState;
  crm: CrmPratica | null;
}

/** id_crm_tipo de la lista To-Do (legacy crm_list.php:54). */
const TIPO_TODO = 1;

/**
 * Atajos del listado legacy `winbody.php?pp=crm&ti=…` → filtros de la API.
 * Paridad con crm_list.php:53-57.
 */
function filtersForShortcut(ti: CrmListShortcut): CrmListFilters {
  switch (ti) {
    // ti=open → c.stato_pratica='A'. Ojo: NO es open_no_todo, que además
    // excluye id_crm_tipo=1 (condición que el legacy no aplica aquí).
    case "open":
      return { stato_pratica: "A" };
    // ti=todo → c.id_crm_tipo='1' AND stato_pratica='A'
    case "todo":
      return { stato_pratica: "A", id_crm_tipo: TIPO_TODO };
    // ti=alert → abiertas en las últimas 240 h (sin last_step='C')
    case "alert":
      return { stato_pratica: "A", alert: true };
  }
}

function isShortcut(v: unknown): v is CrmListShortcut {
  return v === "open" || v === "todo" || v === "alert";
}

export const useCrmStore = defineStore("crm", () => {
  // ─── Lista ───────────────────────────────────────────────────
  const items = ref<CrmPratica[]>([]);
  const total = ref(0);
  const page = ref(1);
  const perPage = ref(25);
  /**
   * Por defecto SÓLO pratiche abiertas.
   *
   * Al legacy nunca se entra sin filtro: el menú siempre lleva
   * `pp=crm&ti=open` o `ti=todo` (crm_list.php:53-54). Aquí el atajo sólo se
   * aplicaba si llegaba `?ti=` en la URL, así que entrando desde cualquier
   * otro sitio la lista salía SIN filtrar: 14.771 pratiche ordenadas por
   * data_open ascendente, es decir el archivo de 2011, con las 186 abiertas
   * sepultadas. Arrancar en 'A' es la paridad real con `ti=open`.
   */
  const filters = ref<CrmListFilters>({ stato_pratica: "A" });
  const sort = ref<CrmListSort | null>(null);
  /** Atajo activo (ti=…), para mostrarlo como chip y poder limpiarlo. */
  const shortcut = ref<CrmListShortcut | null>(null);
  /**
   * QW7: a diferencia de cargo/shipment, CRM no serializa sus filtros a la
   * URL (oggetto/id_crm_tipo/data_open_da/data_open_al) — solo `ti`/
   * `indicator` viven ahí. Sin este flag, CrmListPage.vue reseteaba
   * `filters` al default en CADA montaje, así que volver de un detalle
   * perdía cualquier filtro tipeado a mano. El store sí persiste entre
   * montajes (singleton de Pinia): una vez aplicado el filtro inicial de la
   * sesión, un remount sin `ti`/`indicator` en la URL deja `filters` tal
   * cual está. CrmListPage.vue ahora vive bajo `<KeepAlive>` (ver ME1 en
   * OperationsShell.vue), así que ya no remonta al volver de un detalle —
   * este flag sigue siendo necesario para cuando SÍ remonta (recarga
   * completa de la SPA, entrada directa a `/crm/:id` por URL, etc.).
   */
  const hasAppliedInitialFilters = ref(false);
  const loadingList = ref(false);

  // ─── Detalle ─────────────────────────────────────────────────
  const current = ref<CrmPratica | null>(null);
  const events = ref<CrmEvento[]>([]);
  const messages = ref<CrmMessaggio[]>([]);
  const types = ref<CrmTipo[]>([]);
  const loadingDetail = ref(false);
  const loadingEvents = ref(false);
  const loadingMessages = ref(false);
  const error = ref<string | null>(null);
  const eventsError = ref<string | null>(null);
  const messagesError = ref<string | null>(null);
  const detailId = ref<number | null>(null);

  let detailRequestSequence = 0;
  let eventsRequestSequence = 0;
  let messagesRequestSequence = 0;
  const headerMutationSequences = new Map<keyof CrmPratica, number>();

  interface DetailMutationContext {
    id: number;
    detailSequence: number;
  }

  async function fetchList(): Promise<void> {
    loadingList.value = true;
    try {
      const res = await crmService.list(
        filters.value,
        page.value,
        perPage.value,
        sort.value,
      );
      items.value = res.items ?? [];
      total.value = res.total ?? 0;
    } finally {
      loadingList.value = false;
    }
  }

  /**
   * Aplica un atajo del listado legacy (ti=open|todo|alert) y recarga.
   * Sustituye los filtros activos, como hace el enlace legacy.
   */
  async function applyShortcut(ti: unknown): Promise<void> {
    if (!isShortcut(ti)) return;
    shortcut.value = ti;
    filters.value = filtersForShortcut(ti);
    page.value = 1;
    await fetchList();
  }

  /** Filtros cambiados a mano: el atajo deja de estar activo. */
  async function applyFilters(): Promise<void> {
    shortcut.value = null;
    page.value = 1;
    await fetchList();
  }

  async function setPage(next: number): Promise<void> {
    if (next === page.value) return;
    page.value = next;
    await fetchList();
  }

  async function setPerPage(next: number): Promise<void> {
    if (next === perPage.value) return;
    perPage.value = next;
    page.value = 1;
    await fetchList();
  }

  async function setSort(next: CrmListSort | null): Promise<void> {
    sort.value = next;
    page.value = 1;
    await fetchList();
  }

  async function fetchTypes(): Promise<void> {
    if (types.value.length) return;
    try {
      types.value = await crmService.listTypes();
    } catch {
      types.value = [];
    }
  }

  function errorMessage(errorValue: unknown): string {
    return errorValue instanceof Error ? errorValue.message : "Error";
  }

  function isCurrentDetailRequest(id: number, sequence: number): boolean {
    return detailId.value === id && detailRequestSequence === sequence;
  }

  function captureMutationContext(id: number): DetailMutationContext | null {
    if (detailId.value !== id || Number(current.value?.id ?? 0) !== id) {
      return null;
    }
    return { id, detailSequence: detailRequestSequence };
  }

  function isCurrentMutationContext(context: DetailMutationContext): boolean {
    return (
      isCurrentDetailRequest(context.id, context.detailSequence) &&
      Number(current.value?.id ?? 0) === context.id
    );
  }

  async function fetchEventsForDetail(
    id: number,
    detailSequence: number,
  ): Promise<boolean> {
    const requestSequence = ++eventsRequestSequence;
    loadingEvents.value = true;
    eventsError.value = null;
    try {
      const nextEvents = await crmService.listEvents(id);
      if (
        !isCurrentDetailRequest(id, detailSequence) ||
        eventsRequestSequence !== requestSequence
      ) {
        return false;
      }
      events.value = nextEvents;
      return true;
    } catch (errorValue) {
      if (
        isCurrentDetailRequest(id, detailSequence) &&
        eventsRequestSequence === requestSequence
      ) {
        eventsError.value = errorMessage(errorValue);
      }
      return false;
    } finally {
      if (
        isCurrentDetailRequest(id, detailSequence) &&
        eventsRequestSequence === requestSequence
      ) {
        loadingEvents.value = false;
      }
    }
  }

  async function fetchMessagesForDetail(
    id: number,
    detailSequence: number,
  ): Promise<boolean> {
    const requestSequence = ++messagesRequestSequence;
    loadingMessages.value = true;
    messagesError.value = null;
    try {
      const nextMessages = await crmService.listMessages(id);
      if (
        !isCurrentDetailRequest(id, detailSequence) ||
        messagesRequestSequence !== requestSequence
      ) {
        return false;
      }
      messages.value = nextMessages;
      return true;
    } catch (errorValue) {
      if (
        isCurrentDetailRequest(id, detailSequence) &&
        messagesRequestSequence === requestSequence
      ) {
        messagesError.value = errorMessage(errorValue);
      }
      return false;
    } finally {
      if (
        isCurrentDetailRequest(id, detailSequence) &&
        messagesRequestSequence === requestSequence
      ) {
        loadingMessages.value = false;
      }
    }
  }

  async function fetchEvents(id = detailId.value ?? 0): Promise<boolean> {
    if (id <= 0 || detailId.value !== id) return false;
    return fetchEventsForDetail(id, detailRequestSequence);
  }

  async function fetchMessages(id = detailId.value ?? 0): Promise<boolean> {
    if (id <= 0 || detailId.value !== id) return false;
    return fetchMessagesForDetail(id, detailRequestSequence);
  }

  async function fetchDetail(
    id: number,
    seed: CrmPratica | null = null,
  ): Promise<CrmDetailLoadResult> {
    const requestSequence = ++detailRequestSequence;
    const sameCurrent = Number(current.value?.id ?? 0) === id;
    const matchingSeed = Number(seed?.id ?? 0) === id ? seed : null;

    detailId.value = id;
    loadingDetail.value = true;
    loadingEvents.value = false;
    loadingMessages.value = false;
    error.value = null;
    eventsError.value = null;
    messagesError.value = null;

    if (matchingSeed) {
      current.value = matchingSeed;
      events.value = matchingSeed.events ?? [];
      messages.value = [];
    } else if (!sameCurrent) {
      current.value = null;
      events.value = [];
      messages.value = [];
    }

    try {
      const pratica = await crmService.get(id);
      if (!isCurrentDetailRequest(id, requestSequence)) {
        return { state: "stale", crm: null };
      }
      current.value = pratica;
      loadingDetail.value = false;

      let eventsPromise: Promise<boolean>;
      if (Array.isArray(pratica.events)) {
        events.value = pratica.events;
        eventsPromise = Promise.resolve(true);
      } else {
        eventsPromise = fetchEventsForDetail(id, requestSequence);
      }
      const messagesPromise = fetchMessagesForDetail(id, requestSequence);
      await Promise.allSettled([eventsPromise, messagesPromise]);

      if (!isCurrentDetailRequest(id, requestSequence)) {
        return { state: "stale", crm: null };
      }
      const hasPartialFailure = Boolean(
        eventsError.value || messagesError.value,
      );
      return {
        state: hasPartialFailure ? "partial" : "ready",
        crm: current.value,
      };
    } catch (errorValue) {
      if (!isCurrentDetailRequest(id, requestSequence)) {
        return { state: "stale", crm: null };
      }
      error.value = errorMessage(errorValue);
      return {
        state: current.value ? "partial" : "error",
        crm: current.value,
      };
    } finally {
      if (isCurrentDetailRequest(id, requestSequence)) {
        loadingDetail.value = false;
      }
    }
  }

  function cancelDetailLoad(id = detailId.value): void {
    if (id !== null && detailId.value !== id) return;
    detailRequestSequence += 1;
    eventsRequestSequence += 1;
    messagesRequestSequence += 1;
    loadingDetail.value = false;
    loadingEvents.value = false;
    loadingMessages.value = false;
  }

  async function saveHeader(
    id: number,
    payload: Partial<CrmPratica>,
  ): Promise<void> {
    const context = captureMutationContext(id);
    const fieldSequences = new Map<keyof CrmPratica, number>();
    for (const field of Object.keys(payload) as Array<keyof CrmPratica>) {
      const sequence = (headerMutationSequences.get(field) ?? 0) + 1;
      headerMutationSequences.set(field, sequence);
      fieldSequences.set(field, sequence);
    }
    const updated = await crmService.update(id, payload);
    if (
      !context ||
      Number(updated.id) !== context.id ||
      !isCurrentMutationContext(context) ||
      !current.value
    )
      return;

    const applicablePatch: Partial<CrmPratica> = {};
    for (const [field, sequence] of fieldSequences) {
      if (headerMutationSequences.get(field) !== sequence) continue;
      const value = Object.prototype.hasOwnProperty.call(updated, field)
        ? updated[field]
        : payload[field];
      Object.assign(applicablePatch, { [field]: value });
    }
    current.value = { ...current.value, ...applicablePatch };
  }

  async function addEvent(
    id: number,
    descriz: string,
    stato: StatoPratica,
  ): Promise<void> {
    const context = captureMutationContext(id);
    const created = await crmService.addEvent(id, descriz, stato);
    if (
      !context ||
      Number(created.id_crm) !== context.id ||
      !isCurrentMutationContext(context)
    )
      return;
    // Recargar eventos + cabecera (el estado del padre se recalcula en backend).
    const nextEvents = await crmService.listEvents(id);
    if (!isCurrentMutationContext(context)) return;
    events.value = nextEvents;
    const fresh = await crmService.get(id);
    if (isCurrentMutationContext(context) && current.value) {
      current.value.stato_pratica = fresh.stato_pratica;
    }
  }

  async function removeEvent(id: number, idCrm: number): Promise<void> {
    const context = captureMutationContext(idCrm);
    await crmService.removeEvent(id);
    if (!context || !isCurrentMutationContext(context)) return;
    const nextEvents = await crmService.listEvents(idCrm);
    if (isCurrentMutationContext(context)) events.value = nextEvents;
  }

  /**
   * Edita la descripción de un evento (autosave on-blur, paridad frm=not2).
   * Actualiza la copia local sin recargar toda la lista.
   */
  async function updateEvent(id: number, payload: CrmEventoUpdate): Promise<void> {
    const activeId = detailId.value ?? 0;
    const context = captureMutationContext(activeId);
    const updated = await crmService.updateEvent(id, payload);
    if (
      !context ||
      Number(updated.id_crm) !== context.id ||
      !isCurrentMutationContext(context)
    )
      return;
    // Status/date may change both ordering and the parent case status. Reload
    // both sources so drawer and full-page views remain identical.
    if (payload.stato_pratica || payload.data) {
      const [nextEvents, fresh] = await Promise.all([
        crmService.listEvents(activeId),
        crmService.get(activeId),
      ]);
      if (!isCurrentMutationContext(context)) return;
      events.value = nextEvents;
      if (current.value) current.value.stato_pratica = fresh.stato_pratica;
    } else {
      const idx = events.value.findIndex((e) => Number(e.id) === id);
      if (idx >= 0) events.value[idx] = { ...events.value[idx], ...updated };
    }
  }

  async function sendMessage(
    payload: SendMessagePayload,
    files: File[] = [],
  ): Promise<CrmMessaggio> {
    const context = captureMutationContext(payload.id_crm);
    const msg = await crmService.sendMessage(payload, files);
    if (!context || !isCurrentMutationContext(context)) return msg;
    const nextMessages = await crmService.listMessages(payload.id_crm);
    if (isCurrentMutationContext(context)) messages.value = nextMessages;
    return msg;
  }

  /** Borrado lógico desde el listado (paridad botón Elimina2 de crm_list.php:97). */
  async function removePratica(id: number): Promise<void> {
    await crmService.remove(id);
    await fetchList();
  }

  return {
    items,
    total,
    page,
    perPage,
    filters,
    sort,
    shortcut,
    hasAppliedInitialFilters,
    loadingList,
    current,
    events,
    messages,
    types,
    loadingDetail,
    loadingEvents,
    loadingMessages,
    error,
    eventsError,
    messagesError,
    detailId,
    fetchList,
    fetchTypes,
    fetchDetail,
    fetchEvents,
    fetchMessages,
    cancelDetailLoad,
    saveHeader,
    addEvent,
    removeEvent,
    updateEvent,
    sendMessage,
    applyShortcut,
    applyFilters,
    setPage,
    setPerPage,
    setSort,
    removePratica,
  };
});
