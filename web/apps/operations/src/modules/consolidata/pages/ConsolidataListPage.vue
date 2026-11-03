<template>
  <!-- Listado de proyectos de consolidata: mismas piezas que el de cargo
       (DashboardShell, ListingDataView, FilterDrawer, KPI, chips, vistas). -->
  <div class="shipment-v2" :data-theme="themeName">
    <DashboardShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
      <!-- ============ TOP BAR ============ -->
      <template #topbar-title>
        <button
          type="button"
          class="topbar-iconbtn dsh-brand-btn"
          :title="t('consolidata.list.title')"
          @click="onRefresh"
        >
          <v-icon icon="mdi-layers-triple-outline" size="18" />
        </button>
        <div class="hblock">
          <div class="topbar-shipnum">{{ t("consolidata.list.title") }}</div>
          <div class="topbar-hmeta">
            {{ t("listing.total", { count: totalFormatted }) }}{{ pageInfo }}
          </div>
        </div>
      </template>

      <template #topbar-actions>
        <v-text-field
          v-model="searchText"
          :placeholder="t('consolidata.list.searchPlaceholder')"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="cons-search"
          @update:model-value="onSearchInput"
        />
        <v-menu :close-on-content-click="false" location="bottom end">
          <template #activator="{ props: menuProps }">
            <button
              type="button"
              class="topbar-iconbtn"
              :class="{
                'topbar-iconbtn--active': state.date_from || state.date_to,
              }"
              :title="t('listing.date_range')"
              v-bind="menuProps"
            >
              <v-icon icon="mdi-calendar-range" size="18" />
            </button>
          </template>
          <div class="topbar-datepop card-tmwe">
            <v-select
              v-model="state.quale_data"
              :items="dateFieldItems"
              :label="t('consolidata.filters.qualeData')"
              density="compact"
              variant="outlined"
              hide-details
              @update:model-value="onFilterChange"
            />
            <div class="date-presets">
              <v-btn size="x-small" variant="tonal" @click="setDatePreset(1)">{{
                t("filters.period.today")
              }}</v-btn>
              <v-btn size="x-small" variant="text" @click="setDatePreset(7)">{{
                t("filters.period.days", { n: 7 })
              }}</v-btn>
              <v-btn size="x-small" variant="text" @click="setDatePreset(30)">{{
                t("filters.period.days", { n: 30 })
              }}</v-btn>
            </div>
            <v-text-field
              v-model="state.date_from"
              :label="t('filters.fields.from')"
              type="date"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              @update:model-value="onFilterChange"
            />
            <v-text-field
              v-model="state.date_to"
              :label="t('filters.fields.to')"
              type="date"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              @update:model-value="onFilterChange"
            />
          </div>
        </v-menu>
        <ListingWorkViewSelector
          v-model="workViewId"
          :views="CONSOLIDATA_WORK_VIEWS"
          :label="t('listing.work_view.label')"
        />
        <ViewModeToggle v-model="viewMode" />
        <button
          type="button"
          class="topbar-iconbtn"
          :title="t('consolidata.list.exportCsv')"
          :disabled="exporting || total === 0"
          @click="onExport"
        >
          <v-progress-circular
            v-if="exporting"
            indeterminate
            size="16"
            width="2"
          />
          <v-icon v-else icon="mdi-file-delimited-outline" size="18" />
        </button>
        <router-link
          :to="{ name: 'consolidata-quote' }"
          class="topbar-iconbtn"
          :title="t('consolidata.quote.navLink')"
        >
          <v-icon icon="mdi-calculator-variant-outline" size="18" />
        </router-link>
        <button
          type="button"
          class="topbar-iconbtn"
          :title="loading ? t('platform.loading') : t('common.refresh')"
          :disabled="loading"
          @click="onRefresh"
        >
          <v-icon icon="mdi-refresh" size="18" />
        </button>
        <v-btn
          color="primary"
          size="small"
          prepend-icon="mdi-plus"
          class="ml-1"
          @click="newDialog = true"
        >
          {{ t("consolidata.create.button") }}
        </v-btn>
      </template>

      <!-- ============ SIDEBAR ============ -->
      <template #sidebar="{ collapsed }">
        <OperationsNav :collapsed="collapsed" />
        <ListingKpiStrip
          :tiles="kpiTiles"
          :active="activeTile"
          direction="column"
          :rail="collapsed"
          @select="onKpiSelect"
        />
      </template>

      <!-- ============ MAIN ============ -->
      <ConsolidataFilterPanel
        v-model="filterPanelOpen"
        :client-hint="clientHint"
      />

      <ActiveFilterChips
        :filters="activeFilters"
        :advanced-label="t('listing.advanced_filters')"
        :advanced-title="
          advancedFilterCount > 0
            ? t('listing.advanced_active', { count: advancedFilterCount })
            : t('listing.advanced_open')
        "
        :advanced-count="advancedFilterCount"
        @remove="removeFilter"
        @clear="clearAllFilters"
        @advanced="filterPanelOpen = true"
      />

      <v-skeleton-loader
        v-if="loading && rows.length === 0"
        type="table-tbody"
      />

      <v-alert
        v-else-if="errorText"
        type="error"
        border="start"
        prominent
        class="mb-2"
        icon="mdi-alert-circle"
      >
        <div class="d-flex align-center flex-wrap ga-3">
          <span>{{ errorText }}</span>
          <v-spacer />
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-refresh"
            :loading="loading"
            @click="onRefresh"
          >
            {{ t("listing.error.retry") }}
          </v-btn>
        </div>
      </v-alert>

      <section
        v-else-if="!loading && rows.length === 0"
        class="card-tmwe empty-card"
      >
        <EmptyState
          icon="mdi-layers-off-outline"
          :title="t('consolidata.list.emptyTitle')"
          :text="t('listing.empty_text')"
        />
      </section>

      <ListingDataView
        v-else
        :source="dataSource"
        :headers="headers"
        :selected="selected"
        :mode="viewMode"
        :sort-key-map="SORT_KEY_MAP"
        :selectable="hasBulkAction('assign')"
        :active-row-id="viewId"
        @update:selected="(v) => (selected = v as unknown as QueueItem[])"
        @update:mode="(v) => (viewMode = v)"
        @row-click="
          (row) => openDetail(Number((row as unknown as QueueItem).id))
        "
      >
        <template #bulk-actions="{ selectedIds: ids }">
          <v-btn
            v-if="hasBulkAction('assign') && canAssign"
            variant="text"
            prepend-icon="mdi-account-arrow-right"
            :loading="bulkBusy"
            @click="assignDialog = true"
          >
            {{ t("consolidata.list.bulkAssign", { count: ids.length }) }}
          </v-btn>
        </template>

        <template #[`cell.id`]="{ item }">
          <router-link
            :to="detailTo(row(item).id)"
            class="cons-link font-mono"
            @click.stop="rememberContext(row(item).id)"
          >
            {{ row(item).id }}
          </router-link>
        </template>
        <template #[`cell.titolo`]="{ item }">
          <router-link
            :to="detailTo(row(item).id)"
            class="cons-link text-truncate d-inline-block"
            style="max-width: 260px"
            @click.stop="rememberContext(row(item).id)"
          >
            {{ row(item).titolo || "—" }}
          </router-link>
        </template>
        <template #[`cell.cliente`]="{ item }">
          <button
            v-if="row(item).id_cliente"
            type="button"
            class="filterable font-weight-medium text-truncate"
            style="max-width: 220px"
            :title="t('filters.click.by_client')"
            @click.stop="filterByClient(row(item))"
          >
            {{ row(item).cliente_nome || `#${row(item).id_cliente}` }}
          </button>
          <div
            v-if="row(item).partner_nome"
            class="text-caption text-medium-emphasis"
          >
            {{ row(item).partner_nome }}
          </div>
        </template>
        <template #[`cell.tipo`]="{ item }">
          <button
            type="button"
            class="filterable text-body-2"
            :title="t('consolidata.list.click.tipo')"
            @click.stop="setFilter('tipo', row(item).tipo)"
          >
            {{ typeLabel(row(item).tipo) }}
          </button>
        </template>
        <template #[`cell.ruta`]="{ item }">
          <div class="route-endpoint">
            <button
              v-if="row(item).hub_terminal"
              type="button"
              class="filterable font-mono text-body-2"
              :title="
                t('consolidata.list.click.hub', { v: row(item).hub_terminal })
              "
              @click.stop="
                setFilter('hub_terminal', row(item).hub_terminal ?? '')
              "
            >
              {{ row(item).hub_terminal }}
            </button>
            <span v-else class="text-medium-emphasis">—</span>
            <span class="text-medium-emphasis">→</span>
            <button
              v-if="row(item).dest_country"
              type="button"
              class="filterable route-flag"
              :title="
                t('filters.click.dest_country', { v: row(item).dest_country })
              "
              @click.stop="
                setFilter('dest_country', row(item).dest_country ?? '')
              "
            >
              <CountryFlag :iso="row(item).dest_country ?? ''" :size="16" />
              <span class="font-mono text-body-2 ml-1">{{
                row(item).dest_country
              }}</span>
            </button>
            <span v-else class="text-medium-emphasis">—</span>
          </div>
        </template>
        <template #[`cell.n_spedizioni`]="{ item }">
          <span class="text-body-2">{{ row(item).n_spedizioni ?? 0 }}</span>
        </template>
        <template #[`cell.peso`]="{ item }">
          <span class="text-body-2">{{
            row(item).peso_tassabile != null
              ? `${num(row(item).peso_tassabile, 1)} kg`
              : "—"
          }}</span>
        </template>
        <template #[`cell.totale`]="{ item }">
          <span class="text-body-2">{{ rowTotal(row(item)) }}</span>
        </template>
        <template #[`cell.risposta`]="{ item }">
          <div v-if="row(item).risposta_at" class="text-body-2">
            {{ money(row(item).risposta_prezzo, row(item).valuta) }}
            <div
              class="text-caption"
              :class="
                row(item).fase === 'respuesta_vencida'
                  ? 'text-error'
                  : 'text-medium-emphasis'
              "
            >
              {{ shortDate(row(item).risposta_valida_fino) || "—" }}
            </div>
          </div>
          <span v-else class="text-medium-emphasis">—</span>
        </template>
        <template #[`cell.stato`]="{ item }">
          <v-chip
            :color="stateColor(row(item).stato)"
            size="x-small"
            variant="tonal"
            class="me-1"
          >
            {{ t(stateI18nKey(row(item).stato)) }}
          </v-chip>
          <v-chip
            v-if="row(item).fase"
            :color="phaseColor(row(item).fase)"
            size="x-small"
            variant="outlined"
          >
            {{ t(phaseI18nKey(row(item).fase)) }}
          </v-chip>
        </template>
        <template #[`cell.assegnato`]="{ item }">
          <button
            v-if="row(item).assegnato_a"
            type="button"
            class="filterable text-body-2"
            :title="t('consolidata.list.click.assignee')"
            @click.stop="filterByAssignee(row(item))"
          >
            {{ row(item).assegnato_nome || `#${row(item).assegnato_a}` }}
          </button>
          <button
            v-else
            type="button"
            class="filterable text-body-2 text-medium-emphasis"
            :title="t('consolidata.list.click.assignee')"
            @click.stop="setFilter('assegnato_a', 'none')"
          >
            {{ t("consolidata.list.unassigned") }}
          </button>
        </template>
        <template #[`cell.antiguedad`]="{ item }">
          <span class="text-body-2">{{ ageLabel(row(item)) }}</span>
        </template>
        <template #[`cell.cargo`]="{ item }">
          <router-link
            v-if="row(item).id_cargo"
            :to="{
              name: 'cargo-detail',
              params: { id: String(row(item).id_cargo) },
            }"
            class="cons-link font-mono"
            @click.stop
          >
            {{ row(item).id_cargo }}
          </router-link>
          <span v-else class="text-medium-emphasis">—</span>
        </template>
        <template #[`cell.conversione`]="{ item }">
          <v-chip
            v-if="row(item).conversione"
            size="x-small"
            variant="tonal"
            :color="
              row(item).conversione === 'completo'
                ? 'success'
                : row(item).conversione === 'parcial'
                  ? 'warning'
                  : 'default'
            "
          >
            {{ t(conversionI18nKey(row(item).conversione)) }}
          </v-chip>
        </template>
        <template #[`cell.insert_datetime`]="{ item }">
          <span class="text-body-2">{{
            shortDate(row(item).insert_datetime) || "—"
          }}</span>
        </template>
        <template #[`cell.modif_datetime`]="{ item }">
          <span class="text-body-2">{{
            shortDate(row(item).modif_datetime) || "—"
          }}</span>
        </template>
        <template #[`cell.actions`]="{ item }">
          <div class="d-inline-flex align-center">
            <v-btn
              icon="mdi-eye-outline"
              size="x-small"
              variant="text"
              :title="t('consolidata.preview.title')"
              :aria-label="t('consolidata.preview.title')"
              @click.stop="openPreview(row(item).id)"
            />
            <v-btn
              v-if="canTake(row(item))"
              size="x-small"
              variant="tonal"
              :loading="listStore.takingId === row(item).id"
              @click.stop="onTake(row(item).id)"
            >
              {{ t("consolidata.actions.take") }}
            </v-btn>
          </div>
        </template>
      </ListingDataView>
    </DashboardShell>

    <ConsolidataDetailOverlay
      :model-value="drawerOpen"
      :view-id="viewId"
      @update:model-value="setDrawerOpen"
      @changed="onRefresh"
    />
    <ConsolidataNewProjectDialog v-model="newDialog" @created="onCreated" />
    <ConsolidataAssignDialog
      v-model="assignDialog"
      :saving="bulkBusy"
      :error="assignError"
      :title="t('consolidata.list.bulkAssignTitle', { count: selected.length })"
      @submit="onBulkAssign"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useTheme } from "vuetify";
import EmptyState from "@shared/ui/EmptyState.vue";
import DashboardShell from "@shared/listing/DashboardShell.vue";
import OperationsNav from "@shared/platform/OperationsNav.vue";
import ListingDataView from "@shared/listing/ListingDataView.vue";
import CountryFlag from "@shared/listing/CountryFlag.vue";
import ActiveFilterChips from "@shared/listing/ActiveFilterChips.vue";
import ViewModeToggle from "@shared/listing/ViewModeToggle.vue";
import ListingWorkViewSelector from "@shared/listing/ListingWorkViewSelector.vue";
import ListingKpiStrip from "@shared/listing/ListingKpiStrip.vue";
import type { KpiTileDescriptor } from "@shared/listing/ListingKpiStrip.vue";
import {
  headersForWorkView,
  resolveWorkView,
} from "@shared/listing/work-views";
import { useListViewMode } from "@shared/listing/useListViewMode";
import type { ActiveFilter, DataTableHeader } from "@shared/listing/types";
import {
  clearListContext,
  loadListContext,
  restoreListScroll,
  saveListContext,
} from "@shared/listing/useListContext";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import ConsolidataFilterPanel from "../components/ConsolidataFilterPanel.vue";
import ConsolidataDetailOverlay from "../components/ConsolidataDetailOverlay.vue";
import ConsolidataNewProjectDialog from "../components/ConsolidataNewProjectDialog.vue";
import ConsolidataAssignDialog from "../components/ConsolidataAssignDialog.vue";
import {
  activeKpi,
  buildConsolidataCountsQuery,
  buildConsolidataListQuery,
  consolidataActiveFilterCount,
  consolidataResetFilters,
  kpiCount,
  kpiToState,
  parseConsolidataListQuery,
  serializeConsolidataListQuery,
  toListSource,
  useConsolidataListStore,
  type ConsolidataListUrlState,
} from "../stores/consolidata_list.store";
import { useConsolidataStore } from "../stores/consolidata.store";
import { consolidataService } from "../services/consolidata.service";
import {
  CONSOLIDATA_WORK_VIEWS,
  consolidataDefaultWorkView,
} from "../listing/consolidata-work-views";
import {
  buildCsv,
  downloadText,
  fetchAllRows,
  type CsvColumn,
} from "../listing/csv";
import { useFormat } from "../composables/useFormat";
import {
  actionAvailable,
  ageDays,
  canTakeRow,
  conversionI18nKey,
  errorI18nKey,
  phaseColor,
  phaseI18nKey,
  shortDate,
  stateColor,
  stateI18nKey,
} from "../logic";
import type { ConsolidataError, QueueItem } from "../types";

defineOptions({ name: "ConsolidataListPage" });

const LIST_PAGE = "consolidata-list";

const { t, te } = useI18n();
const router = useRouter();
const route = useRoute();
const theme = useTheme();
const themeName = computed(() => theme.global.name.value);
const listStore = useConsolidataListStore();
const detailStore = useConsolidataStore();
const toast = useToastStore();
const { money, num } = useFormat();
const { state, rows, total, loading, error, counts, bulkBusy } =
  storeToRefs(listStore);

const viewMode = useListViewMode("tmwe:list-view-mode", "paginated");

const errorText = computed<string | null>(() => errorMessage(error.value));

function errorMessage(e: ConsolidataError | null): string | null {
  if (!e) return null;
  const head = t(errorI18nKey(e.code));
  return e.message ? `${head} — ${e.message}` : head;
}

/** Adaptador store → ListSource (ListingDataView). */
const dataSource = computed(() =>
  toListSource({
    state: state.value,
    rows: rows.value,
    total: total.value,
    loading: loading.value,
    error: errorText.value,
    loadPage: listStore.loadPage,
    loadMore: listStore.loadMore,
    refresh: listStore.refresh,
    setSort: listStore.setSort,
    setPerPage: listStore.setPerPage,
  }),
);

/** En las celdas, `item` llega sin tipo: un solo cast aquí. */
const row = (item: unknown): QueueItem => item as QueueItem;
const rowTotal = (r: QueueItem): string => money(r.totale, r.valuta);

// ─── KPI ─────────────────────────────────────────────────────────────────
const KPI_DEFS: Array<{
  key: string;
  icon: string;
  variant?: KpiTileDescriptor["variant"];
}> = [
  { key: "all", icon: "mdi-format-list-bulleted" },
  {
    key: "sin_asignar",
    icon: "mdi-account-question-outline",
    variant: "warning",
  },
  {
    key: "pendiente_respuesta",
    icon: "mdi-email-alert-outline",
    variant: "warning",
  },
  { key: "respondido", icon: "mdi-email-check-outline" },
  {
    key: "respuesta_vencida",
    icon: "mdi-timer-alert-outline",
    variant: "error",
  },
  {
    key: "por_convertir",
    icon: "mdi-cog-transfer-outline",
    variant: "warning",
  },
  { key: "convertido", icon: "mdi-check-decagram-outline", variant: "success" },
  { key: "cancelado", icon: "mdi-cancel" },
];

const activeTile = computed(() => activeKpi(state.value));

const kpiTiles = computed<KpiTileDescriptor[]>(() =>
  KPI_DEFS.map((d) => {
    const n = kpiCount(counts.value, d.key);
    return {
      key: d.key,
      icon: d.icon,
      caption: t(`consolidata.list.kpi.${d.key}`),
      value: n ?? (activeTile.value === d.key ? total.value : "—"),
      variant: d.variant,
    };
  }),
);

function onKpiSelect(key: string): void {
  listStore.applyState({ ...kpiToState(key), page: 1 });
  void listStore.fetchPage();
}

// ─── Columnas y vistas ──────────────────────────────────────────────────
const allHeaders = computed<DataTableHeader[]>(() => [
  { title: t("consolidata.list.headers.id"), key: "id", width: 80 },
  {
    title: t("consolidata.list.headers.titolo"),
    key: "titolo",
    sortable: false,
  },
  { title: t("listing.headers.client"), key: "cliente" },
  {
    title: t("consolidata.list.headers.tipo"),
    key: "tipo",
    width: 90,
    sortable: false,
  },
  {
    title: t("consolidata.list.headers.ruta"),
    key: "ruta",
    width: 150,
    sortable: false,
  },
  {
    title: t("consolidata.list.headers.n_spedizioni"),
    key: "n_spedizioni",
    width: 90,
    align: "end",
    sortable: false,
  },
  {
    title: t("consolidata.list.headers.peso"),
    key: "peso",
    width: 110,
    align: "end",
    sortable: false,
  },
  {
    title: t("consolidata.list.headers.totale"),
    key: "totale",
    width: 120,
    align: "end",
    numeric: true,
  },
  {
    title: t("consolidata.list.headers.risposta"),
    key: "risposta",
    width: 140,
  },
  { title: t("consolidata.list.headers.stato"), key: "stato", width: 220 },
  {
    title: t("consolidata.list.headers.assegnato"),
    key: "assegnato",
    width: 150,
    sortable: false,
  },
  {
    title: t("consolidata.list.headers.antiguedad"),
    key: "antiguedad",
    width: 110,
    sortable: false,
  },
  {
    title: t("consolidata.list.headers.cargo"),
    key: "cargo",
    width: 100,
    sortable: false,
  },
  {
    title: t("consolidata.list.headers.conversione"),
    key: "conversione",
    width: 120,
    sortable: false,
  },
  {
    title: t("consolidata.list.headers.insert_datetime"),
    key: "insert_datetime",
    width: 140,
  },
  {
    title: t("consolidata.list.headers.modif_datetime"),
    key: "modif_datetime",
    width: 140,
  },
  { title: "", key: "actions", width: 110, sortable: false },
]);

/** Columna de la UI → campo de orden del API (lista blanca de Consolidation_Queue_Query::SORTS). */
const SORT_KEY_MAP: Record<string, string> = {
  id: "id",
  cliente: "cliente",
  totale: "totale",
  risposta: "risposta_valida_fino",
  stato: "stato",
  insert_datetime: "insert_datetime",
  modif_datetime: "modif_datetime",
};

const activeWorkView = computed(() =>
  resolveWorkView(
    CONSOLIDATA_WORK_VIEWS,
    route.query.work_view,
    "all",
    consolidataDefaultWorkView(),
  ),
);

const workViewId = computed({
  get: () => activeWorkView.value.id,
  set: (value: string) => {
    const resolved = resolveWorkView(
      CONSOLIDATA_WORK_VIEWS,
      value,
      "all",
      consolidataDefaultWorkView(),
    );
    // La vista de gestión trabaja «más antiguo primero» (FIFO) si el orden era el de por defecto.
    if (
      resolved.id === "gestion" &&
      state.value.sort === "modif_datetime" &&
      state.value.dir === "desc"
    ) {
      listStore.applyState({ dir: "asc", page: 1 });
      void listStore.fetchPage();
    }
    void router.replace({ query: { ...route.query, work_view: resolved.id } });
  },
});

const headers = computed<DataTableHeader[]>(() =>
  headersForWorkView(allHeaders.value, activeWorkView.value),
);

function hasBulkAction(action: string): boolean {
  return (
    (
      activeWorkView.value.bulkActions as readonly string[] | undefined
    )?.includes(action) ?? false
  );
}

const canAssign = computed(() =>
  actionAvailable(detailStore.actions, "assign", "A"),
);
const canTake = (r: QueueItem): boolean => canTakeRow(detailStore.actions, r);

const totalFormatted = computed(() => total.value.toLocaleString());
const pageInfo = computed(() => {
  if (viewMode.value !== "paginated" || total.value === 0) return "";
  const pages = Math.max(
    1,
    Math.ceil(total.value / Math.max(1, state.value.per_page)),
  );
  return ` · ${t("common.page")} ${state.value.page} ${t("common.of")} ${pages.toLocaleString()}`;
});

function typeLabel(tipo: string): string {
  const key = `consolidata.type.${tipo}`;
  return te(key) ? t(key) : tipo;
}

function ageLabel(r: QueueItem): string {
  if (r.stato !== "A" && r.stato !== "P") return "—";
  const d = ageDays(r.insert_datetime);
  return d === null ? "—" : t("consolidata.list.days", { n: d }, d);
}

const dateFieldItems = computed(() =>
  (["insert", "modif", "chiuso", "risposta"] as const).map((v) => ({
    title: t(`consolidata.filters.dateField.${v}`),
    value: v,
  })),
);

// ─── Búsqueda libre ─────────────────────────────────────────────────────
const searchText = ref("");
let searchTimer: ReturnType<typeof setTimeout> | null = null;
function onSearchInput(v: string | null): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = (v ?? "").trim();
    if (q === state.value.q) return;
    listStore.applyState({ q, page: 1 });
    void listStore.fetchPage();
  }, 350);
}

// ─── Clic para filtrar y chips ──────────────────────────────────────────
type ChipField =
  | "q"
  | "tipo"
  | "hub_terminal"
  | "dest_country"
  | "orig_paese"
  | "assegnato_a"
  | "id_cliente"
  | "id_partner"
  | "stato"
  | "fase"
  | "risposta"
  | "conversione"
  | "id_cargo"
  | "totale_min"
  | "totale_max"
  | "n_sped_min"
  | "n_sped_max";

const clientNames = ref<Record<string, string>>({});
const userNames = ref<Record<string, string>>({});
const clientHint = computed(
  () => clientNames.value[state.value.id_cliente] ?? null,
);

function setFilter(field: ChipField, value: string): void {
  const v = (value ?? "").trim();
  if (!v) return;
  listStore.applyState({
    [field]: v,
    page: 1,
  } as Partial<ConsolidataListUrlState>);
  void listStore.fetchPage();
}

function filterByClient(r: QueueItem): void {
  if (r.cliente_nome) clientNames.value[String(r.id_cliente)] = r.cliente_nome;
  setFilter("id_cliente", String(r.id_cliente));
}

function filterByAssignee(r: QueueItem): void {
  if (!r.assegnato_a) return;
  if (r.assegnato_nome)
    userNames.value[String(r.assegnato_a)] = r.assegnato_nome;
  setFilter("assegnato_a", String(r.assegnato_a));
}

function assigneeLabel(v: string): string {
  if (v === "me") return t("consolidata.filters.assigneeMe");
  if (v === "none") return t("consolidata.filters.assigneeNone");
  return userNames.value[v] || `#${v}`;
}

function chipValue(field: ChipField, v: string): string {
  switch (field) {
    case "tipo":
      return typeLabel(v);
    case "assegnato_a":
      return assigneeLabel(v);
    case "id_cliente":
      return clientNames.value[v] || `#${v}`;
    case "stato":
      return v
        .split(",")
        .map((s) => t(stateI18nKey(s)))
        .join(", ");
    case "fase":
      return t(phaseI18nKey(v));
    case "risposta":
      return t(`consolidata.filters.answer.${v}`);
    case "conversione":
      return t(conversionI18nKey(v));
    default:
      return v;
  }
}

const CHIP_FIELDS: ChipField[] = [
  "fase",
  "q",
  "stato",
  "tipo",
  "id_cliente",
  "id_partner",
  "assegnato_a",
  "hub_terminal",
  "orig_paese",
  "dest_country",
  "risposta",
  "conversione",
  "id_cargo",
  "totale_min",
  "totale_max",
  "n_sped_min",
  "n_sped_max",
];

const CHIP_GROUP: Record<ChipField, string> = {
  q: "consolidata.filters.q",
  tipo: "consolidata.filters.tipo",
  hub_terminal: "consolidata.filters.hub",
  dest_country: "consolidata.filters.destCountry",
  orig_paese: "consolidata.filters.origPaese",
  assegnato_a: "consolidata.filters.assegnato",
  id_cliente: "filters.group.client",
  id_partner: "consolidata.filters.partner",
  stato: "consolidata.filters.stato",
  fase: "consolidata.filters.fase",
  risposta: "consolidata.filters.risposta",
  conversione: "consolidata.filters.conversione",
  id_cargo: "consolidata.filters.idCargo",
  totale_min: "consolidata.filters.totaleMin",
  totale_max: "consolidata.filters.totaleMax",
  n_sped_min: "consolidata.filters.nSpedMin",
  n_sped_max: "consolidata.filters.nSpedMax",
};

const dateRangeLabel = computed<string>(() => {
  const from = state.value.date_from;
  const to = state.value.date_to;
  const what = t(`consolidata.filters.dateField.${state.value.quale_data}`);
  let range: string;
  if (from && to)
    range = from === to ? from : t("filters.value.date_range", { from, to });
  else if (from) range = t("filters.value.date_from", { date: from });
  else range = t("filters.value.date_until", { date: to });
  return `${what}: ${range}`;
});

const activeFilters = computed<ActiveFilter[]>(() => {
  const out: ActiveFilter[] = [];
  for (const field of CHIP_FIELDS) {
    const v = String(state.value[field] ?? "");
    if (!v) continue;
    out.push({
      field,
      group: t(CHIP_GROUP[field]),
      value: chipValue(field, v),
      iso: field === "dest_country" || field === "orig_paese" ? v : undefined,
      color: field === "fase" ? "secondary" : undefined,
    });
  }
  if (state.value.date_from || state.value.date_to) {
    out.push({
      field: "date_range",
      group: t("filters.group.date"),
      value: dateRangeLabel.value,
    });
  }
  return out;
});

function removeFilter(field: string): void {
  if (field === "date_range")
    listStore.applyState({ date_from: "", date_to: "", page: 1 });
  else
    listStore.applyState({
      [field]: "",
      page: 1,
    } as Partial<ConsolidataListUrlState>);
  if (field === "q") searchText.value = "";
  void listStore.fetchPage();
}

function clearAllFilters(): void {
  listStore.applyState(consolidataResetFilters(state.value));
  searchText.value = "";
  void listStore.fetchPage();
}

const advancedFilterCount = computed(() =>
  consolidataActiveFilterCount(state.value),
);
const filterPanelOpen = ref(false);

// ─── Fechas ─────────────────────────────────────────────────────────────
function onFilterChange(): void {
  state.value.page = 1;
  void listStore.fetchPage();
}

function localIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function setDatePreset(days: number): void {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - Math.max(0, days - 1));
  listStore.applyState({
    date_from: localIsoDate(from),
    date_to: localIsoDate(to),
    page: 1,
  });
  void listStore.fetchPage();
}

// ─── Selección y acciones ───────────────────────────────────────────────
const selected = ref<QueueItem[]>([]);
const assignDialog = ref(false);
const assignError = ref<ConsolidataError | null>(null);
const newDialog = ref(false);

watch(assignDialog, (open) => {
  if (open) assignError.value = null;
});

async function onBulkAssign(userId: number): Promise<void> {
  const ids = selected.value.map((r) => Number(r.id));
  if (!ids.length) return;
  const res = await listStore.bulkAssign(ids, userId);
  if (res.error) {
    assignError.value = res.error;
    return;
  }
  assignDialog.value = false;
  selected.value = [];
  if (res.failed.length) {
    toast.push(
      "warning",
      t("consolidata.list.bulkAssignPartial", {
        ok: res.ok,
        failed: res.failed.length,
        ids: res.failed.map((f) => `#${f.id}`).join(", "),
      }),
    );
  } else {
    toast.success(t("consolidata.list.bulkAssignDone", { count: res.ok }));
  }
  onRefresh();
}

async function onTake(id: number): Promise<void> {
  const err = await listStore.take(id);
  if (err) {
    // Otro se adelantó (already_assigned) u otro fallo: se recarga para ver el estado real.
    toast.push("error", errorMessage(err) ?? t("consolidata.errors.UNKNOWN"));
    onRefresh();
    return;
  }
  toast.success(t("consolidata.messages.taken"));
  openDetail(id);
}

function onCreated(id: number): void {
  toast.success(t("consolidata.messages.created"));
  openDetail(id);
}

function onRefresh(): void {
  void listStore.fetchPage();
  void listStore.fetchCounts();
}

// ─── Exportar CSV (filtro actual, columnas de la vista activa) ──────────
const exporting = ref(false);

function csvColumns(): CsvColumn<QueueItem>[] {
  const pick: Record<string, CsvColumn<QueueItem>["value"]> = {
    id: (r) => r.id,
    titolo: (r) => r.titolo,
    cliente: (r) => r.cliente_nome || r.id_cliente,
    tipo: (r) => r.tipo,
    ruta: (r) => `${r.hub_terminal || ""} → ${r.dest_country || ""}`,
    n_spedizioni: (r) => r.n_spedizioni,
    peso: (r) => r.peso_tassabile ?? "",
    totale: (r) => r.totale,
    risposta: (r) =>
      r.risposta_at
        ? `${r.risposta_prezzo ?? ""} (${r.risposta_valida_fino ?? ""})`
        : "",
    stato: (r) =>
      `${t(stateI18nKey(r.stato))}${r.fase ? ` / ${t(phaseI18nKey(r.fase))}` : ""}`,
    assegnato: (r) => r.assegnato_nome || r.assegnato_a || "",
    antiguedad: (r) =>
      r.stato === "A" || r.stato === "P"
        ? (ageDays(r.insert_datetime) ?? "")
        : "",
    cargo: (r) => r.id_cargo ?? "",
    conversione: (r) =>
      r.conversione ? t(conversionI18nKey(r.conversione)) : "",
    insert_datetime: (r) => r.insert_datetime ?? "",
    modif_datetime: (r) => r.modif_datetime ?? "",
  };
  const cols: CsvColumn<QueueItem>[] = [];
  for (const h of headers.value) {
    if (h.key === "actions" || !pick[h.key]) continue;
    cols.push({ label: h.title, value: pick[h.key]! });
    // El total y la respuesta llevan moneda: se exporta en columna aparte para que el número sea numérico.
    if (h.key === "totale")
      cols.push({
        label: t("consolidata.list.headers.valuta"),
        value: (r) => r.valuta,
      });
  }
  return cols;
}

async function onExport(): Promise<void> {
  exporting.value = true;
  try {
    const base = buildConsolidataListQuery(state.value);
    const {
      rows: all,
      truncated,
      total: n,
    } = await fetchAllRows(base, (p) => consolidataService.queue(p));
    const csv = buildCsv(all, csvColumns());
    downloadText(csv, `consolidata_${localIsoDate(new Date())}.csv`);
    if (truncated)
      toast.push(
        "warning",
        t("consolidata.list.exportTruncated", { shown: all.length, total: n }),
      );
  } catch (err) {
    const info = (err as { info?: ConsolidataError }).info ?? null;
    toast.push("error", errorMessage(info) ?? t("consolidata.errors.UNKNOWN"));
  } finally {
    exporting.value = false;
  }
}

// ─── Navegación: detalle y vista previa ─────────────────────────────────
function detailTo(id: number) {
  return { name: "consolidata-detail", params: { id: String(id) } };
}

function serializeFilterKey(): string {
  const q = serializeConsolidataListQuery(state.value);
  return Object.keys(q)
    .sort()
    .map((k) => `${k}=${q[k]}`)
    .join("&");
}

function rememberContext(id: number): void {
  saveListContext({
    page: LIST_PAGE,
    filterKey: serializeFilterKey(),
    anchorId: id,
    scrollY: window.scrollY,
    ts: Date.now(),
  });
}

function openDetail(id: number): void {
  rememberContext(id);
  void router.push(detailTo(id));
}

const openViewId = ref<number | null>(null);
let lastOpenAt = 0;

function parseViewId(raw: unknown): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function openPreview(id: number): void {
  lastOpenAt = performance.now();
  openViewId.value = id;
  void router.replace({ query: { ...route.query, view: String(id) } });
}

watch(
  () => route.query.view,
  (raw) => {
    const fromUrl = parseViewId(raw);
    if (fromUrl != null && fromUrl !== openViewId.value)
      openViewId.value = fromUrl;
  },
  { immediate: true },
);

const viewId = computed<number | null>(() => openViewId.value);
const drawerOpen = computed<boolean>(() => viewId.value != null);

function setDrawerOpen(open: boolean): void {
  if (open) return;
  // Cierre espurio que Vuetify emite al montar el drawer (el clic que lo abrió sigue propagándose).
  if (performance.now() - lastOpenAt < 400) return;
  openViewId.value = null;
  if (route.query.view == null) return;
  const query = { ...route.query };
  delete query.view;
  void router.replace({ query });
}

// ─── URL ↔ estado ──────────────────────────────────────────────────────
let urlSyncSuppressed = false;

function syncStateToUrl(): void {
  if (urlSyncSuppressed) return;
  const next: Record<string, string> = serializeConsolidataListQuery(
    state.value,
  );
  if (openViewId.value != null) next.view = String(openViewId.value);
  if (activeWorkView.value.id !== consolidataDefaultWorkView())
    next.work_view = activeWorkView.value.id;
  const cur = route.query;
  const same =
    Object.keys(next).length ===
      Object.keys(cur).filter((k) => k !== "restore").length &&
    Object.entries(next).every(([k, v]) => String(cur[k] ?? "") === v);
  if (same) return;
  void router.replace({ query: next });
}

function syncUrlToState(): void {
  const parsed = parseConsolidataListQuery(
    route.query as Record<string, unknown>,
  );
  urlSyncSuppressed = true;
  listStore.applyState(parsed);
  searchText.value = parsed.q;
  urlSyncSuppressed = false;
}

watch(() => state.value, syncStateToUrl, { deep: true });
watch(
  () => {
    const filters: Record<string, unknown> = { ...route.query };
    delete filters.view;
    delete filters.restore;
    delete filters.work_view;
    return JSON.stringify(filters);
  },
  () => {
    syncUrlToState();
  },
);

/** Los recuentos solo cambian con los filtros (no al paginar, ordenar ni cambiar de mosaico). */
watch(
  () => {
    return JSON.stringify(buildConsolidataCountsQuery(state.value));
  },
  () => void listStore.fetchCounts(),
);

async function enterList(): Promise<void> {
  // Se lee antes de nada: la sincronización estado → URL puede reescribir la query mientras carga.
  const restoring = route.query.restore === "1";
  syncUrlToState();
  void detailStore.fetchMeta();
  await listStore.fetchPage();
  void listStore.fetchCounts();
  if (restoring) {
    const ctx = loadListContext(LIST_PAGE);
    if (ctx && ctx.filterKey === serializeFilterKey()) restoreListScroll(ctx);
    clearListContext(LIST_PAGE);
    const cleaned = { ...route.query };
    delete (cleaned as Record<string, unknown>).restore;
    void router.replace({ query: cleaned });
  }
}

// Bajo <KeepAlive> (OperationsShell KEEP_ALIVE_INCLUDE) volver del detalle reactiva
// la instancia: onActivated recarga para no enseñar datos viejos.
let hasMountedOnce = false;
onMounted(async () => {
  hasMountedOnce = true;
  await enterList();
});
onActivated(() => {
  if (!hasMountedOnce) return;
  void enterList();
});
onBeforeUnmount(() => listStore.cancelInFlight());
onDeactivated(() => listStore.cancelInFlight());
</script>

<style scoped>
.font-mono {
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.875em;
}
.cons-search {
  width: 240px;
  min-width: 160px;
}
.cons-link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
.cons-link:hover {
  text-decoration: underline;
}
.route-endpoint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.route-flag {
  display: inline-flex;
  align-items: center;
}
.filterable {
  display: inline-block;
  max-width: 100%;
  padding: 0;
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
.topbar-iconbtn--active {
  color: rgb(var(--v-theme-primary));
  border-color: rgba(var(--v-theme-primary), 0.5);
}
.topbar-datepop {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  min-width: 240px;
  margin-top: 6px;
}
.date-presets {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
