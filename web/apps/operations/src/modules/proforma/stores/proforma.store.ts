/**
 * Store de proforma: listado (filtros, paginación, items), lookups (motivi /
 * units) cacheados, y mutaciones. Errores de red → toasts globales del http
 * client; aquí solo toasts de éxito.
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { proformaService } from "../services/proforma.service";
import {
  type Proforma,
  type ProformaFilters,
  type ProformaWritePayload,
  type LookupOption,
  type PaginationMeta,
  emptyFilters,
} from "../types";

export const useProformaStore = defineStore("proforma", () => {
  const items = ref<Proforma[]>([]);
  const pagination = ref<PaginationMeta | null>(null);
  const filters = ref<ProformaFilters>(emptyFilters());
  const page = ref(1);
  const perPage = ref(20);
  const loading = ref(false);
  const saving = ref(false);

  // Lookups cacheados (no cambian durante la sesión).
  const motivi = ref<LookupOption[]>([]);
  const units = ref<LookupOption[]>([]);
  const lookupsLoaded = ref(false);

  const total = computed(() => pagination.value?.total ?? 0);

  async function fetchList(): Promise<void> {
    loading.value = true;
    try {
      const res = await proformaService.list(
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

  async function ensureLookups(): Promise<void> {
    if (lookupsLoaded.value) return;
    const [m, u] = await Promise.all([
      proformaService.lookup("motivi"),
      proformaService.lookup("units"),
    ]);
    motivi.value = m;
    units.value = u;
    lookupsLoaded.value = true;
  }

  async function fetchOne(id: number): Promise<Proforma> {
    return proformaService.get(id);
  }

  function setFilters(next: ProformaFilters): void {
    filters.value = next;
    page.value = 1;
  }

  function resetFilters(): void {
    filters.value = emptyFilters();
    page.value = 1;
  }

  function setPage(p: number): void {
    page.value = p;
  }

  async function create(payload: ProformaWritePayload): Promise<Proforma> {
    saving.value = true;
    try {
      const created = await proformaService.create(payload);
      await fetchList();
      return created;
    } finally {
      saving.value = false;
    }
  }

  async function update(
    id: number,
    payload: Partial<ProformaWritePayload>,
  ): Promise<Proforma> {
    saving.value = true;
    try {
      const updated = await proformaService.update(id, payload);
      await fetchList();
      return updated;
    } finally {
      saving.value = false;
    }
  }

  async function remove(id: number): Promise<void> {
    saving.value = true;
    try {
      await proformaService.remove(id);
      await fetchList();
    } finally {
      saving.value = false;
    }
  }

  async function duplicate(
    id: number,
    targetShipmentId: number,
  ): Promise<Proforma> {
    saving.value = true;
    try {
      const dup = await proformaService.duplicate(id, targetShipmentId);
      await fetchList();
      return dup;
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
    saving,
    motivi,
    units,
    total,
    fetchList,
    ensureLookups,
    fetchOne,
    setFilters,
    resetFilters,
    setPage,
    create,
    update,
    remove,
    duplicate,
  };
});
