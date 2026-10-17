<template>
  <div class="giac-page">
    <!-- ── Filtros ─────────────────────────────────────────── -->
    <section class="giac-filters">
      <v-text-field
        v-model.number="local.id_spedizione"
        :label="t('giacenze.giacenze.shipmentId')"
        type="number"
        density="comfortable"
        clearable
        class="giac-filter-field"
        @keyup.enter="applyFilters"
      />
      <v-text-field
        v-model="local.q"
        :label="t('giacenze.giacenze.searchText')"
        density="comfortable"
        clearable
        class="giac-filter-field"
        @keyup.enter="applyFilters"
      />
      <v-text-field
        v-model.number="local.id_cliente"
        :label="t('giacenze.giacenze.clientId')"
        type="number"
        density="comfortable"
        clearable
        class="giac-filter-field"
        @keyup.enter="applyFilters"
      />
      <v-select
        v-model="local.operazione"
        :items="operationItems"
        :label="t('giacenze.giacenze.operation')"
        density="comfortable"
        clearable
        class="giac-filter-field"
      />
      <v-text-field
        v-model="local.data_open_da"
        :label="t('giacenze.giacenze.fromDate')"
        type="date"
        density="comfortable"
        clearable
        class="giac-filter-field"
      />
      <v-text-field
        v-model="local.data_open_a"
        :label="t('giacenze.giacenze.toDate')"
        type="date"
        density="comfortable"
        clearable
        class="giac-filter-field"
      />
      <v-checkbox
        v-model="local.open_only"
        :label="t('giacenze.giacenze.openOnly')"
        density="comfortable"
        hide-details
        class="giac-filter-check"
      />
      <div class="giac-filter-actions">
        <v-btn color="primary" :loading="store.loading" @click="applyFilters">
          {{ t("giacenze.giacenze.applyFilters") }}
        </v-btn>
        <v-btn variant="text" @click="clearFilters">{{
          t("giacenze.giacenze.clearFilters")
        }}</v-btn>
      </div>
    </section>

    <!-- ── Filtros activos (click-to-filter) ──────────────────── -->
    <ActiveFilterChips
      :filters="activeFilters"
      @remove="removeFilter"
      @clear="clearFilters"
    />

    <!-- ── Aging widget ────────────────────────────────────── -->
    <section v-if="agingTiles.length" class="giac-aging">
      <ListingKpiStrip :tiles="agingTiles" />
    </section>

    <!-- ── Toolbar ─────────────────────────────────────────── -->
    <div class="giac-toolbar">
      <div class="giac-toolbar-title">
        <span class="giac-count">{{ store.total }}</span>
        <span class="giac-count-label">{{ t("giacenze.giacenze.title") }}</span>
      </div>
      <v-spacer />
      <v-btn
        v-if="isTmwe"
        variant="tonal"
        prepend-icon="mdi-clock-alert-outline"
        @click="openAutoClose"
      >
        {{ t("giacenze.giacenze.autoClose") }}
      </v-btn>
      <v-btn
        variant="text"
        icon="mdi-refresh"
        :title="t('common.refresh')"
        @click="refresh"
      />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
        {{ t("giacenze.giacenze.new") }}
      </v-btn>
    </div>

    <!-- ── Tabla ───────────────────────────────────────────── -->
    <v-data-table
      :headers="headers"
      :items="store.items"
      :loading="store.loading"
      :no-data-text="t('common.noData')"
      item-value="id"
      class="giac-table"
      hover
    >
      <template #[`item.id_spedizione`]="{ item }">
        <button
          v-if="item.id_spedizione"
          type="button"
          class="filterable"
          :title="t('giacenze.giacenze.filterClick.byShipment')"
          @click.stop="setFilterFromCell('id_spedizione', item.id_spedizione)"
        >
          {{ item.id_spedizione }}
        </button>
        <span v-else>—</span>
      </template>

      <template #[`item.operazione`]="{ item }">
        <button
          v-if="item.operazione"
          type="button"
          class="filterable"
          :title="t('giacenze.giacenze.filterClick.byOperation')"
          @click.stop="setFilterFromCell('operazione', item.operazione)"
        >
          <v-chip
            size="small"
            :color="operationColor(item.operazione)"
            label
            style="cursor: pointer"
          >
            {{ operationLabel(item.operazione) }}
          </v-chip>
        </button>
        <span v-else>—</span>
      </template>

      <template #[`item.addebito_riconsegna`]="{ item }">
        {{ formatCharge(item) }}
      </template>

      <template #[`item.data_open`]="{ item }">
        {{ item.data_open ?? "—" }}
      </template>

      <template #[`item.data_close`]="{ item }">
        {{ item.data_close ?? "—" }}
      </template>

      <template #[`item.actions`]="{ item }">
        <CmRowActions :actions="rowActions(item)" />
      </template>
    </v-data-table>

    <!-- ── Paginación ──────────────────────────────────────── -->
    <div v-if="pageCount > 1" class="giac-pagination">
      <v-pagination
        :model-value="store.page"
        :length="pageCount"
        :total-visible="7"
        density="comfortable"
        @update:model-value="goToPage"
      />
    </div>

    <!-- ── Diálogo crear/editar ────────────────────────────── -->
    <GiacenzaEditDialog
      v-model="dialogOpen"
      :giacenza="editing"
      @saved="onSaved"
    />

    <!-- ── Diálogo auto-close ──────────────────────────────── -->
    <v-dialog v-model="autoCloseOpen" max-width="420">
      <v-card>
        <v-card-title>{{ t("giacenze.giacenze.autoClose") }}</v-card-title>
        <v-card-text>
          <p class="giac-autoclose-hint">
            {{ t("giacenze.giacenze.autoCloseHint") }}
          </p>
          <v-text-field
            v-model.number="autoCloseDays"
            :label="t('giacenze.giacenze.autoCloseDays')"
            type="number"
            min="1"
            max="365"
            density="comfortable"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="autoCloseOpen = false">{{
            t("common.cancel")
          }}</v-btn>
          <v-btn color="primary" :loading="store.saving" @click="runAutoClose">
            {{ t("common.confirm") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import ListingKpiStrip, {
  type KpiTileDescriptor,
} from "@shared/listing/ListingKpiStrip.vue";
import ActiveFilterChips from "@shared/listing/ActiveFilterChips.vue";
import CmRowActions, {
  type RowAction,
} from "@shared/anagrafiche/components/CmRowActions.vue";
import { mdiPencil, mdiCheckCircleOutline, mdiDeleteOutline } from "@mdi/js";
import type { ActiveFilter } from "@shared/listing/types";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import { useConfirmStore } from "@shared/anagrafiche/stores/confirm.store";
import { useGiacenzeStore } from "../stores/giacenze.store";
import { giacenzeService } from "../services/giacenze.service";
import GiacenzaEditDialog from "../components/GiacenzaEditDialog.vue";
import {
  GIACENZA_OPERATIONS,
  emptyFilters,
  type Giacenza,
  type GiacenzaFilters,
  type GiacenzaOperation,
} from "../types";

const { t } = useI18n();
const route = useRoute();
const store = useGiacenzeStore();
const toast = useToastStore();
const confirm = useConfirmStore();

const isTmwe = computed(() => Boolean(window.__TMWE_OPERATIONS__?.isTmwe));

// ── Filtros locales (se aplican explícitamente) ──────────────
const local = reactive<GiacenzaFilters>(emptyFilters());

const operationItems = computed(() =>
  GIACENZA_OPERATIONS.map((op) => ({ title: operationLabel(op), value: op })),
);

const headers = computed(() => [
  { title: t("giacenze.giacenze.shipment"), key: "id_spedizione", width: 110 },
  { title: t("giacenze.giacenze.client"), key: "cliente_rag_soc" },
  { title: t("giacenze.giacenze.tracking"), key: "tracking_descr", width: 160 },
  { title: t("giacenze.giacenze.description"), key: "descriz" },
  { title: t("giacenze.giacenze.operation"), key: "operazione", width: 130 },
  { title: t("giacenze.giacenze.dataOpen"), key: "data_open", width: 120 },
  { title: t("giacenze.giacenze.dataClose"), key: "data_close", width: 120 },
  { title: t("giacenze.giacenze.days"), key: "giacenza_gg", width: 100 },
  {
    title: t("giacenze.giacenze.redeliveryCharge"),
    key: "addebito_riconsegna",
    width: 150,
    align: "end" as const,
  },
  {
    title: t("common.actions"),
    key: "actions",
    sortable: false,
    align: "end" as const,
    width: 140,
  },
]);

const pageCount = computed(() => store.pagination?.total_pages ?? 1);

const agingTiles = computed<KpiTileDescriptor[]>(() => {
  const a = store.aging;
  if (!a) return [];
  const variantFor = (i: number): KpiTileDescriptor["variant"] =>
    i === 0 ? "success" : i === 1 ? "default" : i === 2 ? "warning" : "error";
  const bands = a.bands.map((b, i) => ({
    key: b.label,
    caption: b.label,
    value: b.count,
    variant: variantFor(i),
    icon: "mdi-timer-sand",
  }));
  bands.unshift({
    key: "total",
    caption: t("giacenze.giacenze.aging.total"),
    value: a.summary.total,
    variant: "default",
    icon: "mdi-package-variant-closed",
  });
  return bands;
});

// ── Diálogos ─────────────────────────────────────────────────
const dialogOpen = ref(false);
const editing = ref<Giacenza | null>(null);
const autoCloseOpen = ref(false);
const autoCloseDays = ref(30);

function operationLabel(op: GiacenzaOperation | null): string {
  if (!op) return "—";
  return t(`giacenze.giacenze.operations.${op}`);
}

function operationColor(op: GiacenzaOperation | null): string {
  switch (op) {
    case "A":
      return "info";
    case "C":
      return "success";
    case "R":
      return "warning";
    case "E":
      return "secondary";
    default:
      return "default";
  }
}

function formatCharge(item: Giacenza): string {
  const amount =
    item.addebito_riconsegna_display ?? item.addebito_riconsegna ?? 0;
  if (!amount) return "—";
  const currency = item.addebito_riconsegna_currency ?? "EUR";
  return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function applyFilters(): void {
  store.setFilters({ ...local });
  void store.fetchList();
}

// ── Click-to-filter ──────────────────────────────────────────
// Clicar un valor de celda lo fija en los filtros locales y recarga (AJAX).
// Backend ya soporta operazione e id_spedizione (api_inventory_crud).
function setFilterFromCell(
  field: "id_spedizione" | "operazione",
  value: number | string | null,
): void {
  if (value == null || value === "") return;
  if (field === "id_spedizione") local.id_spedizione = Number(value);
  else local.operazione = value as GiacenzaOperation;
  applyFilters();
}

const activeFilters = computed<ActiveFilter[]>(() => {
  const out: ActiveFilter[] = [];
  if (local.id_spedizione != null) {
    out.push({
      field: "id_spedizione",
      group: t("giacenze.giacenze.shipment") as string,
      value: String(local.id_spedizione),
    });
  }
  if (local.operazione) {
    out.push({
      field: "operazione",
      group: t("giacenze.giacenze.operation") as string,
      value: operationLabel(local.operazione),
    });
  }
  return out;
});

function removeFilter(field: string): void {
  if (field === "id_spedizione") local.id_spedizione = null;
  else if (field === "operazione") local.operazione = null;
  applyFilters();
}

function clearFilters(): void {
  Object.assign(local, emptyFilters());
  store.resetFilters();
  void store.fetchList();
}

function goToPage(p: number): void {
  store.setPage(p);
  void store.fetchList();
}

function refresh(): void {
  void Promise.all([store.fetchList(), store.fetchAging()]);
}

function openCreate(): void {
  editing.value = null;
  dialogOpen.value = true;
}

function openEdit(item: Giacenza): void {
  editing.value = item;
  dialogOpen.value = true;
}

/** Acciones de fila: editar (visible) + cerrar (si no cerrada)/eliminar en kebab. */
function rowActions(item: Giacenza): RowAction[] {
  return [
    {
      key: "edit",
      title: t("common.edit"),
      icon: mdiPencil,
      onClick: () => openEdit(item),
    },
    {
      key: "close",
      title: t("giacenze.giacenze.closeHold"),
      icon: mdiCheckCircleOutline,
      hidden: item.operazione === "C",
      onClick: () => confirmClose(item),
    },
    {
      key: "delete",
      title: t("common.delete"),
      icon: mdiDeleteOutline,
      color: "error",
      divider: true,
      onClick: () => confirmDelete(item),
    },
  ];
}

function onSaved(mode: "created" | "updated"): void {
  toast.success(t(`giacenze.giacenze.messages.${mode}`));
}

async function confirmClose(item: Giacenza): Promise<void> {
  const ok = await confirm.ask({
    title: t("giacenze.giacenze.closeHold"),
    message: t("giacenze.giacenze.messages.closeConfirm"),
    confirmLabel: t("giacenze.giacenze.closeHold"),
  });
  if (!ok) return;
  await store.close(item.id);
  toast.success(t("giacenze.giacenze.messages.closed"));
}

async function confirmDelete(item: Giacenza): Promise<void> {
  const ok = await confirm.ask({
    title: t("common.delete"),
    message: t("giacenze.giacenze.messages.deleteConfirm"),
    confirmLabel: t("common.delete"),
    variant: "danger",
  });
  if (!ok) return;
  await store.remove(item.id);
  toast.success(t("giacenze.giacenze.messages.deleted"));
}

function openAutoClose(): void {
  autoCloseDays.value = 30;
  autoCloseOpen.value = true;
}

async function runAutoClose(): Promise<void> {
  const closed = await store.autoClose(autoCloseDays.value);
  autoCloseOpen.value = false;
  toast.success(
    t("giacenze.giacenze.messages.autoClosed", { count: closed }, closed),
  );
}

/**
 * Deep-link ?id=N (bloque Cross-app de la ficha de expedición): carga la
 * giacenza por id y abre su ficha directamente. Best-effort.
 */
async function openFromDeepLink(): Promise<void> {
  const raw = route.query.id;
  const gid = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(gid) || gid <= 0) return;
  try {
    editing.value = await giacenzeService.get(gid);
    dialogOpen.value = true;
  } catch {
    toast.error(t("giacenze.messages.notFound", { id: gid }));
  }
}

onMounted(() => {
  const indicator = String(route.query.indicator ?? "");
  if (
    indicator === "open_giacenze" ||
    indicator === "giacenze_overdue_15" ||
    indicator === "awaiting_client_response"
  ) {
    local.indicator = indicator;
    store.setFilters({ ...local });
  }
  void Promise.all([store.fetchList(), store.fetchAging()]);
  void openFromDeepLink();
});
</script>

<style scoped>
.giac-page {
  padding: 16px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.giac-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.giac-filter-field {
  max-width: 200px;
  flex: 1 1 160px;
}
.giac-filter-check {
  flex: 0 0 auto;
}
.giac-filter-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.giac-aging {
  margin: 4px 0;
}
.giac-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.giac-toolbar-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.giac-count {
  font-size: 1.4rem;
  font-weight: 700;
}
.giac-count-label {
  color: var(--cm-text-secondary, #64748b);
}
.giac-row-actions {
  display: flex;
  justify-content: flex-end;
}
/* Valor clicable-para-filtrar: texto normal hasta hover/focus. Patrón cargo. */
.filterable {
  display: inline-block;
  max-width: 100%;
  padding: 0 2px;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
  transition:
    color 0.12s,
    background 0.12s,
    box-shadow 0.12s;
}
.filterable:hover {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.08);
}
.filterable:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-primary));
}
.giac-pagination {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}
.giac-autoclose-hint {
  margin-bottom: 16px;
  color: var(--cm-text-secondary, #64748b);
  font-size: 0.9rem;
}
</style>
