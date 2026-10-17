<template>
  <div class="shipment-v2 recharge-list" :data-theme="ui.v2Theme">
    <DashboardShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
      <template #topbar-title>
        <button
          type="button"
          class="topbar-iconbtn dsh-brand-btn"
          :title="t('shipment.recharge.title')"
          @click="onRefresh"
        >
          <v-icon icon="mdi-cash-clock" size="18" />
        </button>
        <div class="hblock">
          <div class="topbar-shipnum">{{ t("shipment.recharge.title") }}</div>
          <div class="topbar-hmeta">
            {{ t("shipment.recharge.count_shipments", { count: total }) }}
          </div>
        </div>
      </template>

      <template #topbar-actions>
        <button
          type="button"
          class="topbar-iconbtn"
          :title="t('shipment.recharge.back_to_shipments')"
          @click="goToShipments"
        >
          <v-icon icon="mdi-truck-fast-outline" size="18" />
        </button>
        <ViewModeToggle v-model="viewMode" />
        <button
          type="button"
          class="topbar-iconbtn"
          :title="t('common.refresh')"
          :disabled="loading"
          @click="onRefresh"
        >
          <v-icon icon="mdi-refresh" size="18" />
        </button>
      </template>

      <!-- Sidebar: selector de vista (faddebit2 vs to_apply) + botón de filtros
           avanzados (drawer), mismo patrón que cargo/shipment/invoicing. -->
      <template #sidebar="{ collapsed }">
        <!-- Menú universal (sustituye a PlatformSidebar vía `hide-platform-nav`). -->
        <OperationsNav :collapsed="collapsed" />

        <div v-if="!collapsed" class="rl-sidebar">
          <div class="rl-sidebar__title">
            {{ t("shipment.recharge.views") }}
          </div>
          <button
            v-for="v in viewItems"
            :key="v.value"
            type="button"
            class="rl-viewbtn"
            :class="{ 'rl-viewbtn--active': state.view === v.value }"
            @click="onViewChange(v.value)"
          >
            <v-icon :icon="v.icon" size="16" class="me-2" />
            {{ v.title }}
          </button>
        </div>
        <button
          type="button"
          class="sidebar-action"
          :class="{ 'sidebar-action--rail': collapsed }"
          :title="
            activeFilterCount > 0
              ? t('shipment.recharge.advanced_filters_n', {
                  n: activeFilterCount,
                })
              : t('shipment.recharge.open_advanced_filters')
          "
          @click="filterPanelOpen = true"
        >
          <v-icon icon="mdi-tune-variant" size="16" />
          <span v-if="!collapsed" class="sidebar-action-label">{{
            t("shipment.recharge.advanced_filters")
          }}</span>
          <span v-if="activeFilterCount > 0" class="filters-card-badge">{{
            activeFilterCount
          }}</span>
        </button>
      </template>

      <!-- Drawer de filtros avanzados (sustituye la antigua toolbar horizontal). -->
      <RechargeFilterPanel
        v-model="filterPanelOpen"
        :filters="{
          date_from: state.date_from,
          date_to: state.date_to,
          id_fornitore: state.id_fornitore,
        }"
        :loading="loading"
        @apply="onApplyFilters"
      />

      <!-- Filtros activos como chips removibles (click-to-filter). -->
      <ActiveFilterChips
        :filters="activeFilters"
        class="mx-3 mt-2"
        @remove="removeFilter"
        @clear="clearAllFilters"
      />

      <!-- Estados: loading / error / empty / tabla -->
      <v-skeleton-loader
        v-if="loading && rows.length === 0"
        type="table-tbody"
        class="ma-3"
      />

      <v-alert v-else-if="error" type="error" border="start" class="ma-3">
        {{ error }}
      </v-alert>

      <EmptyState
        v-else-if="!loading && rows.length === 0"
        icon="mdi-cash-check"
        :title="t('shipment.recharge.empty_title')"
        :text="
          state.view === 'faddebit2'
            ? t('shipment.recharge.empty_faddebit2')
            : t('shipment.recharge.empty_to_apply')
        "
      />

      <ListingDataView
        v-else
        :source="dataSource"
        :headers="headers"
        :selected="selected"
        :mode="viewMode"
        :sort-key-map="SORT_KEY_MAP"
        @update:selected="(v) => (selected = v as RechargeListRow[])"
        @update:mode="(v) => (viewMode = v)"
      >
        <template #cell.id="{ item }">
          <code class="font-mono">#{{ (item as RechargeListRow).id }}</code>
        </template>

        <template #cell.cliente_nome="{ item }">
          <div class="rl-cliente">
            <button
              type="button"
              class="filterable rl-cliente__name"
              :title="t('shipment.recharge.filter_click.by_client')"
              @click.stop="filterByClient(item as RechargeListRow)"
            >
              {{ (item as RechargeListRow).cliente_nome || "—" }}
            </button>
            <span
              v-if="(item as RechargeListRow).rif_cliente"
              class="rl-cliente__rif"
            >
              {{ (item as RechargeListRow).rif_cliente }}
            </span>
          </div>
        </template>

        <template #cell.peso="{ item }">
          <span :class="weightClass(item as RechargeListRow)">
            {{ fmtKg((item as RechargeListRow).peso_tassato) }}
            <v-icon
              v-if="
                (item as RechargeListRow).delta_peso &&
                (item as RechargeListRow).delta_peso! > 0
              "
              icon="mdi-arrow-right"
              size="12"
            />
            <template
              v-if="
                (item as RechargeListRow).delta_peso &&
                (item as RechargeListRow).delta_peso! > 0
              "
            >
              {{ fmtKg((item as RechargeListRow).peso_fornit_reale ?? 0) }}
            </template>
          </span>
        </template>

        <template #cell.delta_peso="{ item }">
          <span
            :class="
              (item as RechargeListRow).delta_peso &&
              (item as RechargeListRow).delta_peso! > 0
                ? 'rl-pos'
                : ''
            "
          >
            {{ fmtKg((item as RechargeListRow).delta_peso ?? 0) }}
          </span>
        </template>

        <template #cell.carico_cliente="{ item }">
          {{ fmtEur((item as RechargeListRow).carico_cliente) }}
        </template>

        <template #cell.postfatt="{ item }">
          <span :class="(item as RechargeListRow).postfatt > 0 ? 'rl-pos' : ''">
            {{ fmtEur((item as RechargeListRow).postfatt) }}
          </span>
        </template>

        <template #cell.controllo_fatt="{ item }">
          <StatusChip
            :status="(item as RechargeListRow).controllo_fatt"
            :map="CF_STATUS_MAP"
            size="x-small"
          />
        </template>

        <template #cell.actions="{ item }">
          <v-btn
            size="small"
            variant="text"
            color="primary"
            prepend-icon="mdi-cash-plus"
            @click.stop="openRecharge((item as RechargeListRow).id)"
          >
            {{ t("shipment.recharge.charge") }}
          </v-btn>
        </template>

        <template #bulk-actions="{ selectedIds: ids }">
          <v-btn
            variant="text"
            prepend-icon="mdi-cash-multiple"
            :loading="bulkBusy"
            @click="onBulkApply(ids)"
          >
            {{ t("shipment.recharge.apply_recharge_n", { n: ids.length }) }}
          </v-btn>
        </template>
      </ListingDataView>
    </DashboardShell>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter, useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import {
  useRechargeListStore,
  parseRechargeListQuery,
  serializeRechargeListQuery,
} from "@shipment/stores/recharge_list.store";
import {
  rechargeService,
  type RechargeListRow,
  type RechargeView,
} from "@shipment/services/recharge.service";
import { useToastStore } from "@shipment/stores/toast.store";
import { useUiStore } from "@shipment/stores/ui.store";
import DashboardShell from "@shared/listing/DashboardShell.vue";
import OperationsNav from "@shared/platform/OperationsNav.vue";
import ListingDataView from "@shared/listing/ListingDataView.vue";
import ViewModeToggle from "@shared/listing/ViewModeToggle.vue";
import ActiveFilterChips from "@shared/listing/ActiveFilterChips.vue";
import { useListViewMode } from "@shared/listing/useListViewMode";
import type {
  ListSource,
  DataTableHeader,
  ActiveFilter,
} from "@shared/listing/types";
import RechargeFilterPanel, {
  type RechargeFilters,
} from "@shipment/components/recharge/RechargeFilterPanel.vue";
import { formatMoneyIT, formatWeightKg } from "@shared/utils/format";
import EmptyState from "@shared/ui/EmptyState.vue";
import StatusChip, { type StatusEntry } from "@shared/ui/StatusChip.vue";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const store = useRechargeListStore();
const ui = useUiStore();
const toasts = useToastStore();
const { state, rows, total, loading, error } = storeToRefs(store);

const viewMode = useListViewMode("tmwe:list-view-mode", "paginated");
const selected = ref<RechargeListRow[]>([]);
const bulkBusy = ref(false);

// Drawer de filtros avanzados + nº de filtros activos (badge).
const filterPanelOpen = ref(false);
const activeFilterCount = computed(
  () =>
    [
      state.value.date_from,
      state.value.date_to,
      state.value.id_fornitore,
    ].filter((v) => v !== "" && v != null).length,
);

const viewItems = computed(() => [
  {
    title: t("shipment.recharge.view_pending"),
    value: "faddebit2" as RechargeView,
    icon: "mdi-clipboard-alert-outline",
  },
  {
    title: t("shipment.recharge.view_to_apply"),
    value: "to_apply" as RechargeView,
    icon: "mdi-cash-clock",
  },
]);

const headers = computed<DataTableHeader[]>(() => [
  { title: t("shipment.recharge.col_id"), key: "id", width: 110 },
  { title: t("shipment.recharge.col_client"), key: "cliente_nome" },
  { title: t("shipment.recharge.col_date"), key: "data_sped0", width: 120 },
  {
    title: t("shipment.recharge.col_weight"),
    key: "peso",
    align: "end",
    width: 150,
  },
  {
    title: t("shipment.recharge.col_weight_diff"),
    key: "delta_peso",
    align: "end",
    width: 110,
  },
  {
    title: t("shipment.recharge.col_charge"),
    key: "carico_cliente",
    align: "end",
    width: 110,
  },
  {
    title: t("shipment.recharge.col_postfatt"),
    key: "postfatt",
    align: "end",
    width: 110,
  },
  {
    title: t("shipment.recharge.col_status"),
    key: "controllo_fatt",
    align: "center",
    width: 110,
  },
  { title: "", key: "actions", align: "end", sortable: false, width: 130 },
]);

// No hay orden server-side en este listado (legacy ordena por data_sped0 DESC).
const SORT_KEY_MAP: Record<string, string> = {};

const dataSource = computed<ListSource<RechargeListRow>>(() => ({
  total: total.value,
  rows: rows.value,
  loading: loading.value,
  error: error.value,
  page: state.value.page,
  perPage: state.value.per_page,
  sort: "",
  sortDir: "DESC",
  loadPage: store.loadPage,
  loadMore: store.loadMore,
  refresh: store.refresh,
  setSort: () => {},
  setPerPage: store.setPerPage,
}));

// ── Formato ──────────────────────────────────────────────────────────────
// Moneda/peso vía utilidades compartidas (@shared/utils/format): estilo IT
// "€ 1.234,56" — coherente con el resto de la app shipment (CostiCard, etc.) —
// y coerción a number incluida (evita "toFixed is not a function").
const fmtEur = (v: number | string): string => formatMoneyIT(v);
const fmtKg = (v: number | string): string => formatWeightKg(v);
function weightClass(r: RechargeListRow): string {
  return Number(r.delta_peso ?? 0) > 0 ? "rl-pos" : "";
}

// controllo_fatt → chip (paridad labels legacy dropdown). Mapa estado→{label,color}
// consumido por el StatusChip compartido (@shared/ui/StatusChip).
const CF_STATUS_MAP = computed<Record<string, StatusEntry>>(() => ({
  CA: { label: t("shipment.recharge.cf_ca"), color: "warning" },
  NO: { label: t("shipment.recharge.cf_no"), color: "default" },
  OK: { label: t("shipment.recharge.cf_ok"), color: "success" },
}));

// ── Acciones ─────────────────────────────────────────────────────────────
function onViewChange(v: RechargeView): void {
  state.value.view = v;
  onFilterChange();
}
function onFilterChange(): void {
  state.value.page = 1;
  void store.fetchPage();
}
/** Aplica los filtros que llegan del drawer (RechargeFilterPanel). */
function onApplyFilters(next: RechargeFilters): void {
  state.value.date_from = next.date_from;
  state.value.date_to = next.date_to;
  state.value.id_fornitore = next.id_fornitore;
  onFilterChange();
}
function onRefresh(): void {
  void store.refresh();
}
function goToShipments(): void {
  router.push({ name: "shipment-list" });
}

/** Abre el riaddebito navegando al detalle con ?modal=riaddebito (reusa RiaddebitoDialog). */
function openRecharge(id: number): void {
  router.push({
    name: "shipment-detail",
    params: { id: String(id) },
    query: { modal: "riaddebito" },
  });
}

// ── Click-to-filter ────────────────────────────────────────────────────────
// Clicar el cliente en una fila filtra el listado por ese cliente (vía AJAX,
// backend Recharge_Controller op=pending + filtro id_cliente). Abrir/aplicar el
// riaddebito es exclusivo del botón de acción de la fila.
const clientNameById = ref<Record<string, string>>({});

function filterByClient(row: RechargeListRow): void {
  const id = String(row.id_cliente ?? "");
  if (!id || id === "0") return;
  if (row.cliente_nome) clientNameById.value[id] = row.cliente_nome;
  state.value.id_cliente = id;
  onFilterChange();
}

const activeFilters = computed<ActiveFilter[]>(() => {
  const out: ActiveFilter[] = [];
  if (state.value.id_cliente) {
    out.push({
      field: "id_cliente",
      group: t("shipment.recharge.col_client") as string,
      value:
        clientNameById.value[state.value.id_cliente] ??
        `#${state.value.id_cliente}`,
    });
  }
  return out;
});

function removeFilter(field: string): void {
  if (field === "id_cliente") {
    state.value.id_cliente = "";
    onFilterChange();
  }
}
function clearAllFilters(): void {
  state.value.id_cliente = "";
  onFilterChange();
}

/** Aplicación masiva: aplica riaddebito a los seleccionados (paridad "Addebita differenze" batch). */
async function onBulkApply(ids: number[]): Promise<void> {
  if (!ids.length) return;
  bulkBusy.value = true;
  let ok = 0;
  const errors: string[] = [];
  try {
    for (const id of ids) {
      try {
        const r = await rechargeService.apply(id);
        if (r.success) ok++;
        else errors.push(`#${id}: ${r.error ?? t("shipment.recharge.error")}`);
      } catch (e) {
        errors.push(`#${id}: ${(e as Error).message}`);
      }
    }
    if (ok > 0)
      toasts.push("success", t("shipment.recharge.toast_applied_n", { n: ok }));
    if (errors.length)
      toasts.push(
        "warning",
        t("shipment.recharge.toast_failed_n", { n: errors.length }),
      );
    selected.value = [];
    await store.fetchPage();
  } finally {
    bulkBusy.value = false;
  }
}

// ── URL ↔ state ──────────────────────────────────────────────────────────
watch(
  () => state.value,
  () => {
    const q = serializeRechargeListQuery(state.value);
    void router.replace({ query: q }).catch(() => {});
  },
  { deep: true },
);

onMounted(() => {
  store.applyState(parseRechargeListQuery(route.query));
  void store.fetchPage();
});
</script>

<style scoped>
.rl-sidebar {
  padding: 12px;
}
.rl-sidebar__title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.6;
  margin-bottom: 8px;
}
.rl-viewbtn {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  color: inherit;
}
.rl-viewbtn:hover {
  background: rgb(var(--v-theme-surface-variant), 0.4);
}
.rl-viewbtn--active {
  background: rgb(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}
.rl-cliente {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  align-items: flex-start;
}
.rl-cliente__rif {
  font-size: 11px;
  opacity: 0.6;
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
.rl-pos {
  color: rgb(var(--v-theme-error));
  font-weight: 600;
}
.font-mono {
  font-feature-settings: "tnum";
}
</style>
