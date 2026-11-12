/**
 * Store de giacenze: estado del listado (filtros, paginación, items), del aging
 * y de las mutaciones (crear/editar/cerrar). Las llamadas pasan por
 * giacenzeService; los errores de red ya disparan toasts globales vía el http
 * client compartido — aquí solo añadimos toasts de éxito y de validación local.
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { giacenzeService } from "../services/giacenze.service";
import {
  type Giacenza,
  type GiacenzaFilters,
  type GiacenzaWritePayload,
  type GiacenzaOperation,
  type AgingResult,
  type PaginationMeta,
  emptyFilters,
} from "../types";
import {
  DEFAULT_QUEUE,
  QUEUE_ORDER,
  queueFilters,
  type QueueId,
} from "../queues";

export const useGiacenzeStore = defineStore("giacenze", () => {
  // ── Listado ───────────────────────────────────────────────
  const items = ref<Giacenza[]>([]);
  const pagination = ref<PaginationMeta | null>(null);
  const filters = ref<GiacenzaFilters>(emptyFilters());
  const page = ref(1);
  const perPage = ref(50);
  const loading = ref(false);

  // ── Aging ─────────────────────────────────────────────────
  const aging = ref<AgingResult | null>(null);
  const agingLoading = ref(false);

  // ── Mutaciones ────────────────────────────────────────────
  const saving = ref(false);

  const total = computed(() => pagination.value?.total ?? 0);

  // ── Colas de trabajo ──────────────────────────────────────
  /** Cola activa; null = filtros libres que no corresponden a ninguna cola. */
  const queue = ref<QueueId | null>(DEFAULT_QUEUE);
  /** Totales por cola (peticiones de conteo: per_page=1); ausente = aún sin dato, null = falló. */
  const queueCounts = ref<Partial<Record<QueueId, number | null>>>({});

  /** Fija una cola: sus filtros de servidor sustituyen a los anteriores de cola. */
  function selectQueue(id: QueueId): void {
    queue.value = id;
    filters.value = { ...filters.value, ...queueFilters(id) };
    page.value = 1;
  }

  async function fetchQueueCounts(): Promise<void> {
    await Promise.all(
      QUEUE_ORDER.filter((id) => id !== "all").map(async (id) => {
        try {
          const n = await giacenzeService.count({
            ...emptyFilters(),
            ...queueFilters(id),
          });
          queueCounts.value = { ...queueCounts.value, [id]: n };
        } catch {
          queueCounts.value = { ...queueCounts.value, [id]: null };
        }
      }),
    );
  }

  async function fetchList(): Promise<void> {
    loading.value = true;
    try {
      const res = await giacenzeService.list(
        filters.value,
        page.value,
        perPage.value,
      );
      items.value = res.data;
      pagination.value = res.pagination;
    } finally {
      loading.value = false;
    }
  }

  async function fetchAging(): Promise<void> {
    agingLoading.value = true;
    try {
      aging.value = await giacenzeService.aging();
    } finally {
      agingLoading.value = false;
    }
  }

  function setFilters(next: GiacenzaFilters): void {
    filters.value = next;
    page.value = 1;
  }

  function resetFilters(): void {
    filters.value = { ...emptyFilters(), ...queueFilters("all") };
    queue.value = "all";
    page.value = 1;
  }

  function setPage(p: number): void {
    page.value = p;
  }

  async function create(payload: GiacenzaWritePayload): Promise<Giacenza> {
    saving.value = true;
    try {
      const created = await giacenzeService.create(payload);
      await Promise.all([fetchList(), fetchAging()]);
      return created;
    } finally {
      saving.value = false;
    }
  }

  async function update(
    id: number,
    payload: Partial<GiacenzaWritePayload>,
  ): Promise<Giacenza> {
    saving.value = true;
    try {
      const updated = await giacenzeService.update(id, payload);
      await Promise.all([fetchList(), fetchAging()]);
      return updated;
    } finally {
      saving.value = false;
    }
  }

  async function updateOperation(
    id: number,
    operation: GiacenzaOperation,
    fields: Parameters<typeof giacenzeService.updateOperation>[2] = {},
  ): Promise<Giacenza> {
    saving.value = true;
    try {
      const updated = await giacenzeService.updateOperation(
        id,
        operation,
        fields,
      );
      await fetchList();
      return updated;
    } finally {
      saving.value = false;
    }
  }

  async function close(id: number): Promise<void> {
    saving.value = true;
    try {
      await giacenzeService.close(id);
      await Promise.all([fetchList(), fetchAging()]);
    } finally {
      saving.value = false;
    }
  }

  async function reopen(id: number, reason = ""): Promise<void> {
    saving.value = true;
    try {
      await giacenzeService.reopen(id, reason);
      await Promise.all([fetchList(), fetchAging(), fetchQueueCounts()]);
    } finally {
      saving.value = false;
    }
  }

  async function remove(id: number): Promise<void> {
    saving.value = true;
    try {
      await giacenzeService.remove(id);
      await Promise.all([fetchList(), fetchAging()]);
    } finally {
      saving.value = false;
    }
  }

  async function autoClose(maxDays: number): Promise<number> {
    saving.value = true;
    try {
      const res = await giacenzeService.autoClose(maxDays);
      await Promise.all([fetchList(), fetchAging()]);
      return res.closed ?? 0;
    } finally {
      saving.value = false;
    }
  }

  return {
    items,
    pagination,
    filters,
    page,
    perPage,
    loading,
    aging,
    agingLoading,
    saving,
    total,
    queue,
    queueCounts,
    selectQueue,
    fetchQueueCounts,
    reopen,
    fetchList,
    fetchAging,
    setFilters,
    resetFilters,
    setPage,
    create,
    update,
    updateOperation,
    close,
    remove,
    autoClose,
  };
});
