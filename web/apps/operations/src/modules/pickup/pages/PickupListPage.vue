<script setup lang="ts">
import { todayLocal } from "@shared/utils/date";
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import ListingDataView from "@shared/listing/ListingDataView.vue";
import ListingKpiStrip, {
  type KpiTileDescriptor,
} from "@shared/listing/ListingKpiStrip.vue";
import ListingWorkViewSelector from "@shared/listing/ListingWorkViewSelector.vue";
import type { ListSource } from "@shared/listing/types";
import StatusChip from "@shared/ui/StatusChip.vue";
import { useConfirmStore } from "@shared/anagrafiche/stores/confirm.store";
import { pickupsService } from "../services/pickups.service";
import PickupEditDialog from "../components/PickupEditDialog.vue";
import DriverAssignDialog from "../components/DriverAssignDialog.vue";
import RecurringDialog from "../components/RecurringDialog.vue";
import {
  PICKUP_QUEUES,
  isIncoherent,
  isOverdueOpen,
  queueFilters,
  type PickupQueueId,
} from "../logic";
import type { Pickup, PickupFilters } from "../types";

const { t } = useI18n();
const confirm = useConfirmStore();

const today = todayLocal();
const queue = ref<PickupQueueId>("all");
const filters = ref<PickupFilters>({
  data_da: today,
  data_a: null,
  affidata: null,
  presa_fissa: null,
});

const error = ref<string | null>(null);
const selected = ref<Pickup[]>([]);
const editing = ref<Pickup | null>(null);
const dialogOpen = ref(false);
const assignOpen = ref(false);
const recurringOpen = ref(false);
const recurringSede = ref<number | null>(null);

/** Cola «Vencidas»: el API no filtra por «ritiro hecho», se descartan en pantalla. */
function visible(rows: Pickup[]): Pickup[] {
  return queue.value === "overdue" ? rows.filter(isOverdueOpen) : rows;
}

/** Adaptador `ListSource` sobre la paginación del servidor. */
const source: ListSource<Pickup> = reactive({
  total: 0,
  rows: [] as Pickup[],
  loading: false,
  error: null as string | null,
  page: 1,
  perPage: 25,
  sort: "",
  sortDir: "ASC" as "ASC" | "DESC",
  async loadPage(page: number): Promise<void> {
    source.page = page;
    await fetchRows();
  },
  async loadMore(): Promise<void> {
    /* solo modo paginado */
  },
  async refresh(): Promise<void> {
    source.page = 1;
    await fetchRows();
  },
  setSort(sort: string, dir: "ASC" | "DESC"): void {
    source.sort = sort;
    source.sortDir = dir;
  },
  setPerPage(n: number): void {
    source.perPage = n;
    source.page = 1;
  },
});

async function fetchRows(): Promise<void> {
  source.loading = true;
  error.value = null;
  try {
    const res = await pickupsService.list(filters.value, source.page, source.perPage);
    source.rows = visible(res.data);
    source.total = res.pagination.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  } finally {
    source.loading = false;
  }
}

// --- colas de trabajo y KPI (conteo = total paginado del API con los filtros de la cola)

const counts = ref<Partial<Record<PickupQueueId, number | null>>>({});

async function loadCounts(): Promise<void> {
  const ids = PICKUP_QUEUES.map((q) => q.id as PickupQueueId).filter(
    (id) => id !== "all",
  );
  const entries = await Promise.all(
    ids.map(async (id) => {
      // «Vencidas» no tiene conteo exacto: el API no filtra por ritiro hecho.
      if (id === "overdue") return [id, null] as const;
      try {
        const res = await pickupsService.list(queueFilters(id, today), 1, 1);
        return [id, res.pagination.total] as const;
      } catch {
        return [id, null] as const;
      }
    }),
  );
  counts.value = Object.fromEntries(entries);
}

const tiles = computed<KpiTileDescriptor[]>(() =>
  PICKUP_QUEUES.filter((q) => q.id !== "all").map((q) => ({
    key: q.id,
    caption: t(q.labelKey),
    value: counts.value[q.id as PickupQueueId] ?? "—",
    variant: q.id === "overdue" || q.id === "to_assign" ? "warning" : "default",
  })),
);

function selectQueue(id: string): void {
  queue.value = id as PickupQueueId;
  if (id !== "all") {
    filters.value = {
      ...queueFilters(queue.value, today),
      presa_fissa: filters.value.presa_fissa,
    };
  }
  selected.value = [];
  void source.refresh();
}

/** Un filtro manual saca de la cola de trabajo. */
function applyFilters(): void {
  queue.value = "all";
  selected.value = [];
  void source.refresh();
}

// --- acciones

function openCreate(): void {
  editing.value = null;
  dialogOpen.value = true;
}

function openEdit(row: Pickup): void {
  editing.value = row;
  dialogOpen.value = true;
}

function openRecurring(sedeId: number | null): void {
  recurringSede.value = sedeId;
  recurringOpen.value = true;
}

async function reload(): Promise<void> {
  selected.value = [];
  await Promise.all([source.refresh(), loadCounts()]);
}

async function onSaved(): Promise<void> {
  dialogOpen.value = false;
  await reload();
}

/** Una fija se retira solo ese día (el API la deja en R); una no fija se anula. */
async function remove(row: Pickup): Promise<void> {
  const fixed = row.presa_fissa === "S";
  const ok = await confirm.ask({
    title: t(fixed ? "pickup.list.remove_today_title" : "pickup.list.delete_title"),
    message: t(fixed ? "pickup.list.remove_today_msg" : "pickup.list.delete_msg", {
      id: row.id,
    }),
    variant: "danger",
  });
  if (!ok) return;
  try {
    await pickupsService.remove(row.id);
    await reload();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action");
  }
}

const fixedMap = computed(() => ({
  S: { label: t("pickup.list.fixed"), color: "info" },
  R: { label: t("pickup.list.fixed_removed"), color: "warning" },
  N: { label: "—", color: "default" },
}));

const fixedOptions = computed(() => [
  { title: t("pickup.list.any"), value: null },
  { title: t("pickup.list.fixed"), value: "S" },
  { title: t("pickup.list.adhoc"), value: "N" },
  { title: t("pickup.list.fixed_removed"), value: "R" },
]);

/** Las celdas de `ListingDataView` llegan tipadas como fila genérica. */
function row(x: unknown): Pickup {
  return x as Pickup;
}

const headers = computed(() => [
  { title: t("pickup.list.col.id"), key: "id", width: 70, sortable: false },
  { title: t("pickup.list.col.data"), key: "data", sortable: false },
  { title: t("pickup.list.col.sede"), key: "id_sede", sortable: false },
  { title: t("pickup.list.col.autista"), key: "id_contatti", sortable: false },
  { title: t("pickup.list.col.address"), key: "address_sped", sortable: false },
  { title: t("pickup.list.col.colli"), key: "n_colli", sortable: false },
  { title: t("pickup.list.col.peso"), key: "peso", sortable: false },
  { title: t("pickup.list.col.fixed"), key: "presa_fissa", sortable: false },
  { title: t("pickup.list.col.affidata"), key: "affidata", sortable: false },
  { title: "", key: "actions", sortable: false, width: 150 },
]);

onMounted(() => {
  void source.refresh();
  void loadCounts();
});
</script>

<template>
  <div class="pk-page">
    <header class="pk-page-head">
      <h1 class="pk-page-title">{{ t("pickup.list.title") }}</h1>
      <div class="d-flex ga-2">
        <v-btn
          variant="tonal"
          prepend-icon="mdi-calendar-sync"
          @click="openRecurring(null)"
        >
          {{ t("pickup.list.recurring") }}
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
          {{ t("pickup.list.new") }}
        </v-btn>
      </div>
    </header>

    <ListingKpiStrip :tiles="tiles" :active="queue" @select="selectQueue" />

    <div class="pk-filters">
      <ListingWorkViewSelector
        :model-value="queue"
        :views="PICKUP_QUEUES"
        :label="t('pickup.queue.label')"
        @update:model-value="selectQueue"
      />
      <v-text-field
        v-model="filters.data_da"
        :label="t('pickup.list.from')"
        type="date"
        density="compact"
        variant="outlined"
        hide-details
      />
      <v-text-field
        v-model="filters.data_a"
        :label="t('pickup.list.to')"
        type="date"
        density="compact"
        variant="outlined"
        hide-details
      />
      <v-select
        v-model="filters.affidata"
        :items="[
          { title: t('pickup.list.any'), value: null },
          { title: t('pickup.list.yes'), value: 'S' },
          { title: t('pickup.list.no'), value: 'N' },
        ]"
        :label="t('pickup.list.col.affidata')"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 160px"
      />
      <v-select
        v-model="filters.presa_fissa"
        :items="fixedOptions"
        :label="t('pickup.list.col.fixed')"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 200px"
      />
      <v-btn variant="tonal" @click="applyFilters">{{
        t("pickup.list.filter")
      }}</v-btn>
    </div>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ error }}
    </v-alert>

    <ListingDataView
      v-model:selected="selected"
      :source="source"
      :headers="headers"
      mode="paginated"
      :sort-key-map="{}"
    >
      <template #bulk-actions="{ selectedIds }">
        <v-btn
          size="small"
          variant="tonal"
          prepend-icon="mdi-account-switch"
          :disabled="selectedIds.length === 0"
          @click="assignOpen = true"
        >
          {{ t("pickup.list.bulk_assign") }}
        </v-btn>
      </template>
      <template #[`cell.id`]="{ item: raw }">{{ row(raw).id }}</template>
      <template #[`cell.data`]="{ item: raw }">{{ row(raw).data }}</template>
      <template #[`cell.id_sede`]="{ item: raw }">{{ row(raw).id_sede }}</template>
      <template #[`cell.id_contatti`]="{ item: raw }">
        {{ row(raw).id_contatti || "—" }}
        <v-icon
          v-if="isIncoherent(row(raw))"
          icon="mdi-alert-outline"
          size="16"
          color="warning"
          :title="t('pickup.list.incoherent')"
        />
      </template>
      <template #[`cell.address_sped`]="{ item: raw }">
        {{
          row(raw).address_sped === "S"
            ? t("pickup.list.triangulation")
            : t("pickup.list.at_sede")
        }}
      </template>
      <template #[`cell.n_colli`]="{ item: raw }">{{ row(raw).n_colli ?? "—" }}</template>
      <template #[`cell.peso`]="{ item: raw }">{{ row(raw).peso ?? "—" }}</template>
      <template #[`cell.presa_fissa`]="{ item: raw }">
        <StatusChip
          v-if="row(raw).presa_fissa !== 'N'"
          :status="row(raw).presa_fissa"
          :map="fixedMap"
          size="x-small"
        />
        <span v-else>—</span>
      </template>
      <template #[`cell.affidata`]="{ item: raw }">
        <v-chip
          size="x-small"
          :color="row(raw).affidata === 'S' ? 'success' : 'default'"
        >
          {{
            row(raw).affidata === "S" ? t("pickup.list.yes") : t("pickup.list.no")
          }}
        </v-chip>
      </template>
      <template #[`cell.actions`]="{ item: raw }">
        <v-btn
          v-if="row(raw).presa_fissa === 'S'"
          icon="mdi-calendar-sync"
          size="x-small"
          variant="text"
          :title="t('pickup.list.recurring_sede')"
          @click="openRecurring(row(raw).id_sede)"
        />
        <v-btn
          icon="mdi-pencil"
          size="x-small"
          variant="text"
          :title="t('pickup.edit.edit_title')"
          @click="openEdit(row(raw))"
        />
        <v-btn
          v-if="row(raw).presa_fissa !== 'R'"
          :icon="row(raw).presa_fissa === 'S' ? 'mdi-calendar-remove' : 'mdi-delete'"
          size="x-small"
          variant="text"
          color="error"
          :title="
            row(raw).presa_fissa === 'S'
              ? t('pickup.list.remove_today')
              : t('pickup.list.delete_title')
          "
          @click="remove(row(raw))"
        />
      </template>
    </ListingDataView>

    <PickupEditDialog v-model="dialogOpen" :pickup="editing" @saved="onSaved" />
    <DriverAssignDialog
      v-model="assignOpen"
      :pickup="null"
      :pickup-ids="selected.map((p) => p.id)"
      :date="today"
      @changed="reload"
    />
    <RecurringDialog
      v-model="recurringOpen"
      :sede-id="recurringSede"
      @changed="reload"
    />
  </div>
</template>

<style scoped>
.pk-page {
  padding: 24px;
}
.pk-page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.pk-page-title {
  font-size: 1.5rem;
  font-weight: 600;
}
.pk-filters {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin: 16px 0;
}
.pk-filters .v-text-field {
  max-width: 180px;
}
</style>
