<template>
  <!--
    Dashboard layout: fixed top bar + collapsible sidebar + main content.
    The shell lives inside the `.shipment-v2` namespace so it inherits
    Inter typography, tokens and light/dark themes from mockup2.scss
    (same look as the CargoDetailPage). The shell sets its own grid; the
    page content slots into it.
  -->
  <div class="shipment-v2" :data-theme="ui.v2Theme">
    <DashboardShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
      <!-- ============ TOP BAR ============ -->
      <template #topbar-title>
        <button
          type="button"
          class="topbar-iconbtn dsh-brand-btn"
          :title="t('listing.cargo.title_back')"
          @click="onTitleClick"
        >
          <v-icon icon="mdi-airplane" size="18" />
        </button>
        <div class="hblock">
          <div class="topbar-shipnum">{{ t("listing.cargo.title") }}</div>
          <div class="topbar-hmeta">
            {{ t("listing.total", { count: totalFormatted }) }}{{ pageInfo }}
          </div>
        </div>
      </template>

      <template #topbar-actions>
        <!-- Date range lives in the topbar. Column filters (client, lane,
             carrier, status) are applied by clicking values in the rows
             (click-to-filter). -->
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
            <div class="date-presets">
              <v-btn size="x-small" variant="tonal" @click="setDatePreset(1)">{{ t("filters.period.today") }}</v-btn>
              <v-btn size="x-small" variant="text" @click="setDatePreset(7)">{{ t("filters.period.days", { n: 7 }) }}</v-btn>
              <v-btn size="x-small" variant="text" @click="setDatePreset(30)">{{ t("filters.period.days", { n: 30 }) }}</v-btn>
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
          :views="CARGO_WORK_VIEWS"
          :label="t('listing.work_view.label')"
        />
        <ViewModeToggle v-model="viewMode" />
        <ShipmentExportMenu
          :selected-ids="selectedIds"
          :params="exportParams"
          type="cargo"
        />
        <button
          type="button"
          class="topbar-iconbtn"
          :title="loading ? t('platform.loading') : t('common.refresh')"
          :disabled="loading"
          @click="onRefresh"
        >
          <v-icon icon="mdi-refresh" size="18" />
        </button>
      </template>

      <!-- ============ SIDEBAR ============ -->
      <template #sidebar="{ collapsed }">
        <!-- Menú universal (el mismo de #/home y del detalle), sustituye a
             PlatformSidebar vía `hide-platform-nav`. El rail de KPIs va debajo. -->
        <OperationsNav :collapsed="collapsed" />

        <!-- KPI rail: same tile primitives, vertical layout. In rail mode
             (collapsed sidebar) tiles shrink to icon-only. -->
        <ListingKpiStrip
          :tiles="kpiTiles"
          :active="state.type"
          direction="column"
          :rail="collapsed"
          @select="onKpiSelect"
        />

      </template>

      <!-- ============ MAIN ============ -->
      <CargoFilterPanel v-model="filterPanelOpen" />

      <!-- Active filters — removable chips for everything applied via
             click-to-filter (client, lane, carrier, status) plus the
             home-tile deep-link, if any. Hidden when nothing is active. -->
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

      <!-- Loading state -->
      <v-skeleton-loader
        v-if="loading && rows.length === 0"
        type="table-tbody"
      />

      <!-- Error -->
      <v-alert
        v-else-if="error"
        type="error"
        border="start"
        prominent
        class="mb-2"
        icon="mdi-alert-circle"
      >
        <div class="d-flex align-center flex-wrap ga-3">
          <span>{{ error }}</span>
          <v-spacer />
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-refresh"
            :loading="loading"
            @click="store.fetchPage()"
          >
            {{ t("listing.error.retry") }}
          </v-btn>
        </div>
      </v-alert>

      <!-- Empty -->
      <section
        v-else-if="!loading && rows.length === 0"
        class="card-tmwe empty-card"
      >
        <EmptyState
          icon="mdi-airplane-off"
          :title="t('listing.cargo.empty_title')"
          :text="t('listing.empty_text')"
        />
      </section>

      <!-- Data table — shared shared/listing/ListingDataView handles
             both paginated and infinite (auto-fetch) modes, plus the
             view-mode toggle. Slot names (cell.*) match column keys. -->
      <ListingDataView
        v-else
        :source="dataSource"
        :headers="headers"
        :selected="selected"
        :mode="viewMode"
        :sort-key-map="SORT_KEY_MAP"
        :active-row-id="viewId"
        @update:selected="(v) => (selected = v as CargoListRow[])"
        @update:mode="(v) => (viewMode = v)"
        @row-click="(row) => openCargo((row as CargoListRow).id)"
      >
        <template #bulk-actions="{ selectedIds: ids }">
          <v-btn
            v-if="hasBulkAction('control')"
            variant="text"
            prepend-icon="mdi-check-bold"
            :loading="bulkBusy"
            @click="onBulkControl"
          >
            {{ t("listing.bulk.mark_controlled", { count: ids.length }) }}
          </v-btn>
          <v-btn
            v-if="hasBulkAction('archive')"
            variant="text"
            prepend-icon="mdi-archive"
            :loading="bulkBusy"
            @click="onBulkArchive"
          >
            {{ t("listing.bulk.archive") }}
          </v-btn>
        </template>

        <!-- Solo el número: "abrir en modern" vive en la columna de acciones,
             no duplicado aquí. -->
        <template #cell.id="{ item }">
          <span class="font-mono">{{ (item as CargoListRow).id }}</span>
        </template>
        <template #cell.cliente="{ item }">
          <div class="text-body-2">
            <!-- Filtra por `id_cliente` (indexado), no por el nombre vía
                 `search`. Paridad con el listado courier. -->
            <button
              v-if="(item as CargoListRow).cliente"
              type="button"
              class="filterable font-weight-medium text-truncate"
              style="max-width: 240px"
              :title="t('filters.click.by_client')"
              @click.stop="filterByClient(item as CargoListRow)"
            >
              {{ (item as CargoListRow).cliente }}
            </button>
            <span v-else class="text-medium-emphasis">—</span>
            <button
              v-if="(item as CargoListRow).rif_cliente"
              type="button"
              class="filterable text-caption text-medium-emphasis"
              :title="t('filters.click.by_rif')"
              @click.stop="
                setFilter(
                  'RIF_cliente',
                  (item as CargoListRow).rif_cliente,
                  'RIF',
                )
              "
            >
              {{ (item as CargoListRow).rif_cliente }}
            </button>
          </div>
        </template>
        <template #cell.origin="{ item }">
          <div class="route-endpoint">
            <button
              type="button"
              class="filterable route-flag"
              :title="
                t('filters.click.origin_country', {
                  v:
                    (item as CargoListRow).origin.country_name ||
                    (item as CargoListRow).origin.country,
                })
              "
              :disabled="!(item as CargoListRow).origin.country"
              @click.stop="
                setLaneFilter(
                  'part',
                  'country',
                  (item as CargoListRow).origin.country,
                )
              "
            >
              <CountryFlag
                :iso="(item as CargoListRow).origin.country"
                :size="16"
              />
            </button>
            <button
              v-if="(item as CargoListRow).origin.terminal"
              type="button"
              class="filterable font-mono text-body-2"
              :title="
                t('filters.click.origin_terminal', {
                  v: (item as CargoListRow).origin.terminal,
                })
              "
              @click.stop="
                setLaneFilter(
                  'part',
                  'terminal',
                  (item as CargoListRow).origin.terminal,
                )
              "
            >
              {{ (item as CargoListRow).origin.terminal }}
            </button>
            <!-- Sin terminal no se repite el ISO como texto: la bandera de la
                 izquierda ya identifica el país y sigue siendo clicable para
                 filtrar por él. -->
            <span
              v-else-if="!(item as CargoListRow).origin.country"
              class="text-medium-emphasis"
              >—</span
            >
          </div>
        </template>
        <template #cell.destination="{ item }">
          <div class="route-endpoint">
            <button
              type="button"
              class="filterable route-flag"
              :title="
                t('filters.click.dest_country', {
                  v:
                    (item as CargoListRow).destination.country_name ||
                    (item as CargoListRow).destination.country,
                })
              "
              :disabled="!(item as CargoListRow).destination.country"
              @click.stop="
                setLaneFilter(
                  'dest',
                  'country',
                  (item as CargoListRow).destination.country,
                )
              "
            >
              <CountryFlag
                :iso="(item as CargoListRow).destination.country"
                :size="16"
              />
            </button>
            <button
              v-if="(item as CargoListRow).destination.terminal"
              type="button"
              class="filterable font-mono text-body-2"
              :title="
                t('filters.click.dest_terminal', {
                  v: (item as CargoListRow).destination.terminal,
                })
              "
              @click.stop="
                setLaneFilter(
                  'dest',
                  'terminal',
                  (item as CargoListRow).destination.terminal,
                )
              "
            >
              {{ (item as CargoListRow).destination.terminal }}
            </button>
            <!-- Sin terminal no se repite el ISO: la bandera identifica el
                 país y sigue siendo clicable para filtrar. -->
            <span
              v-else-if="!(item as CargoListRow).destination.country"
              class="text-medium-emphasis"
              >—</span
            >
          </div>
        </template>
        <template #cell.awb="{ item }">
          <div
            v-if="
              (item as CargoListRow).awb || (item as CargoListRow).airline.code
            "
          >
            <div
              v-if="(item as CargoListRow).awb"
              class="font-mono text-body-2"
            >
              {{ (item as CargoListRow).awb }}
            </div>
            <button
              v-if="(item as CargoListRow).airline.code"
              type="button"
              class="filterable text-caption text-medium-emphasis"
              :title="
                t('filters.click.by_carrier', {
                  v:
                    (item as CargoListRow).airline.full_name ||
                    (item as CargoListRow).airline.code,
                })
              "
              @click.stop="
                setFilter(
                  'airline_code',
                  (item as CargoListRow).airline.code,
                  'Carrier',
                )
              "
            >
              {{ (item as CargoListRow).airline.code }}
            </button>
          </div>
          <span v-else class="text-medium-emphasis">—</span>
        </template>
        <template #cell.created="{ item }">
          <button
            type="button"
            class="filterable text-body-2"
            :title="
              (item as CargoListRow).dates.created
                ? t('filters.click.by_day', {
                    v: dayOf((item as CargoListRow).dates.created),
                  })
                : ''
            "
            :disabled="!(item as CargoListRow).dates.created"
            @click.stop="filterByDay((item as CargoListRow).dates.created)"
          >
            {{ dayOf((item as CargoListRow).dates.created) || "—" }}
          </button>
        </template>
        <template #cell.flight="{ item }">
          <div
            v-if="!isEmptyDate((item as CargoListRow).dates.flight_departure)"
            class="text-body-2"
          >
            {{ formatDate((item as CargoListRow).dates.flight_departure) }}
          </div>
          <div v-else class="text-medium-emphasis">—</div>
          <div
            v-if="!isEmptyDate((item as CargoListRow).dates.delivered)"
            class="text-caption text-medium-emphasis"
          >
            → {{ formatDate((item as CargoListRow).dates.delivered) }}
          </div>
        </template>
        <template #cell.packages="{ item }">
          <span class="text-body-2">{{
            (item as CargoListRow).packages || 0
          }}</span>
        </template>
        <template #cell.weight="{ item }">
          <span class="text-body-2"
            >{{
              Number((item as CargoListRow).weight.declared ?? 0).toFixed(1)
            }}
            kg</span
          >
        </template>
        <template #cell.status="{ item }">
          <v-chip
            v-for="b in statusBadges(item as CargoListRow)"
            :key="b.label"
            :color="b.color"
            size="x-small"
            variant="tonal"
            class="me-1"
          >
            {{ b.label }}
          </v-chip>
        </template>
        <template #cell.actions="{ item }">
          <!-- Mismo juego de acciones que el listado de shipment: mostrar la
               vista previa moderna + abrir el detalle legacy. -->
          <div class="d-inline-flex align-center">
            <v-btn
              icon="mdi-eye-outline"
              size="x-small"
              variant="text"
              :title="t('listing.open_modern')"
              @click.stop="openCargo((item as CargoListRow).id)"
            />
            <v-btn
              :href="legacyDetailHref((item as CargoListRow).id)"
              target="_blank"
              rel="noopener"
              icon="mdi-folder-open-outline"
              size="x-small"
              variant="text"
              :title="t('listing.open_legacy')"
              @click.stop
            />
          </div>
        </template>
      </ListingDataView>
    </DashboardShell>

    <CargoDetailOverlay
      :model-value="drawerOpen"
      :view-id="viewId"
      @update:model-value="setDrawerOpen"
    />
  </div>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter, useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import {
  cargoListService,
  type CargoListRow,
} from "@cargo/services/cargo.service";
import {
  useCargoListStore,
  parseCargoListQuery,
  serializeCargoListQuery,
  buildCargoListQuery,
  cargoActiveFilterCount,
  cargoResetFilters,
} from "@cargo/stores/cargo_list.store";
import { useToastStore } from "@cargo/stores/toast.store";
import { useUiStore } from "@cargo/stores/ui.store";
import CargoFilterPanel from "@cargo/components/cargo/CargoFilterPanel.vue";
import CargoDetailOverlay from "@cargo/components/cargo/CargoDetailOverlay.vue";
import DashboardShell from "@shared/listing/DashboardShell.vue";
import OperationsNav from "@shared/platform/OperationsNav.vue";
import ListingDataView from "@shared/listing/ListingDataView.vue";
import CountryFlag from "@shared/listing/CountryFlag.vue";
import ActiveFilterChips from "@shared/listing/ActiveFilterChips.vue";
import ViewModeToggle from "@shared/listing/ViewModeToggle.vue";
import ListingWorkViewSelector from "@shared/listing/ListingWorkViewSelector.vue";
import {
  headersForWorkView,
  resolveWorkView,
} from "@shared/listing/work-views";
import ShipmentExportMenu from "@shipment/components/shipment/ShipmentExportMenu.vue";
import ListingKpiStrip from "@shared/listing/ListingKpiStrip.vue";
import type { KpiTileDescriptor } from "@shared/listing/ListingKpiStrip.vue";
import {
  findKpiForListing,
  kpiGroupLabel,
  kpiLabel,
} from "@shared/dashboard/home_kpi_catalog";
import { useListViewMode } from "@shared/listing/useListViewMode";
import type {
  ListSource,
  ActiveFilter,
  DataTableHeader,
} from "@shared/listing/types";
import {
  loadListContext,
  clearListContext,
  restoreListScroll,
} from "@shared/listing/useListContext";
import {
  CARGO_WORK_VIEWS,
  cargoDefaultWorkView,
} from "@cargo/listing/cargo-work-views";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const store = useCargoListStore();
const ui = useUiStore();
const { state, rows, total, loading, error } = storeToRefs(store);

/**
 * View mode: `paginated` (page-by-page) or `infinite` (auto-fetch on scroll).
 * Persisted to localStorage with a key shared with the shipment SPA so the
 * user's preference applies across both lists.
 */
const viewMode = useListViewMode("tmwe:list-view-mode", "paginated");

/**
 * Adapter that exposes the cargo store via the generic ListSource contract
 * expected by ListingDataView. The view component is store-agnostic — it
 * sees a uniform `loadPage / loadMore / refresh / setSort / setPerPage` API.
 */
const dataSource = computed<ListSource<CargoListRow>>(() => ({
  total: total.value,
  rows: rows.value,
  loading: loading.value,
  error: error.value,
  page: state.value.page,
  perPage: state.value.per_page,
  sort: state.value.sort,
  sortDir: state.value.sort_dir,
  loadPage: store.loadPage,
  loadMore: store.loadMore,
  refresh: store.refresh,
  setSort: store.setSort,
  setPerPage: store.setPerPage,
}));

function onTitleClick(): void {
  state.value.page = 1;
  void store.fetchPage();
}

/**
 * KPI tiles for the cargo dashboard. Counts are not pre-fetched (would
 * be N extra round trips); we surface the absolute total once it loads,
 * and the rest carry an em-dash until a future endpoint provides them.
 * The tile keys MUST match `CargoListUrlState['type']` so clicking one
 * sets the corresponding filter.
 */
/**
 * Contador del KPI no activo. Mismo criterio que el listado de shipment: el
 * backend lo resuelve barato (~0,14 s), así que se pide con `per_page=1` en
 * vez de mostrar un em-dash permanente. Fuera del store a propósito — éste
 * comparte AbortController con el listado y lo cancelaría.
 */
const kpiCounts = ref<Record<string, number>>({});

const KPI_KEYS = ["in_transit"] as const;

async function refreshKpiCounts(): Promise<void> {
  const base = buildCargoListQuery(state.value);
  await Promise.all(
    KPI_KEYS.map(async (key) => {
      try {
        const r = await cargoListService.fetch({
          ...base,
          type: key,
          page: 1,
          per_page: 1,
        });
        kpiCounts.value[key] = r.pagination?.total ?? 0;
      } catch {
        delete kpiCounts.value[key];
      }
    }),
  );
}

/** Cifra del tile: la del listado si es el tipo activo, si no la cacheada. */
function kpiValue(key: string): number | string {
  if (state.value.type === key) return total.value;
  return kpiCounts.value[key] ?? "—";
}

const kpiTiles = computed<KpiTileDescriptor[]>(() => [
  {
    key: "all",
    icon: "mdi-format-list-bulleted",
    caption: t("listing.cargo.kpi.all"),
    value: total.value,
  },
  {
    key: "in_transit",
    icon: "mdi-airplane-takeoff",
    caption: t("listing.cargo.kpi.in_transit"),
    value: kpiValue("in_transit"),
    sub: t("listing.cargo.kpi.in_transit_sub"),
    variant: "success",
  },
]);

function onKpiSelect(key: string): void {
  if (key === state.value.type) return;
  // The store's `normalisedType` rejects unknown keys; no need to
  // hardcode a whitelist here. Catalog KPIs (`toqt`, `clwt`, …) are
  // accepted alongside the macro `all`/`in_transit`.
  store.applyState({ type: key, kpi: "", page: 1 });
  void store.fetchPage();
}

function onRefresh(): void {
  void store.fetchPage();
}

/**
 * Symbolic header keys used by v-data-table-server (drives `#item.X` slots).
 * Sort fields are mapped to backend SQL columns via SORT_KEY_MAP below — this
 * keeps slot names readable while letting the backend enforce its whitelist.
 */
const allHeaders = computed<DataTableHeader[]>(() => [
  { title: t("listing.headers.id"), key: "id", width: 110 },
  { title: t("listing.headers.client"), key: "cliente" },
  { title: t("listing.headers.origin"), key: "origin", width: 130 },
  { title: t("listing.headers.destination"), key: "destination", width: 130 },
  { title: t("listing.cargo.headers.mawb_carrier"), key: "awb", width: 170 },
  { title: t("listing.headers.created"), key: "created", width: 130 },
  { title: t("listing.cargo.headers.flight"), key: "flight", width: 150 },
  {
    title: t("listing.headers.packages"),
    key: "packages",
    width: 100,
    align: "end",
  },
  {
    title: t("listing.headers.weight"),
    key: "weight",
    width: 100,
    align: "end",
  },
  {
    title: t("listing.headers.status"),
    key: "status",
    width: 220,
    sortable: false,
  },
  { title: "", key: "actions", width: 60, sortable: false },
]);

const activeWorkView = computed(() =>
  resolveWorkView(
    CARGO_WORK_VIEWS,
    route.query.work_view,
    state.value.type,
    cargoDefaultWorkView(state.value.type),
  ),
);

const workViewId = computed({
  get: () => activeWorkView.value.id,
  set: (value: string) => {
    const resolved = resolveWorkView(
      CARGO_WORK_VIEWS,
      value,
      state.value.type,
      cargoDefaultWorkView(state.value.type),
    );
    void router.replace({
      query: { ...route.query, work_view: resolved.id },
    });
  },
});

const headers = computed<DataTableHeader[]>(() =>
  headersForWorkView(allHeaders.value, activeWorkView.value),
);

function hasBulkAction(action: string): boolean {
  return activeWorkView.value.bulkActions?.some((item) => item === action) ?? false;
}

/**
 * Maps UI column keys to backend sort fields.
 * Backend whitelist: Cargo_Shipments_Request_Handler::ALLOWED_SORT_FIELDS.
 * Keys absent from this map are non-sortable. Origin/destination sort by
 * their terminal (the airport code shown in the cell); the JOIN-backed
 * country sort is wired via Smart_Query_Builder::get_sort_required_joins.
 */
const SORT_KEY_MAP: Record<string, NonNullable<typeof state.value.sort>> = {
  id: "sp.id",
  cliente: "ang.rag_soc",
  origin: "sp.terminal_part",
  destination: "sp.terminal_dest",
  awb: "sp.AWB_forn",
  created: "sp.data_sped1",
  flight: "sp.data_volo_partenza",
  packages: "sp.colli",
  weight: "sp.peso",
};

const totalFormatted = computed(() => total.value.toLocaleString("en-US"));

/** «· Página X de Y» junto al total; solo en modo paginado (el infinito no tiene páginas). */
const pageInfo = computed(() => {
  if (viewMode.value !== "paginated" || total.value === 0) return "";
  const pages = Math.max(1, Math.ceil(total.value / Math.max(1, state.value.per_page)));
  return ` · ${t("common.page")} ${state.value.page} ${t("common.of")} ${pages.toLocaleString("en-US")}`;
});

/**
 * If we arrived via a home-tile deep-link (e.g. `?type=clwt`), look
 * up the catalog descriptor so the chip can show the same label/icon/
 * variant the home tile used. Returns null for plain macro types
 * (`all`, `in_transit`).
 */
const activeHomeKpi = computed(() =>
  findKpiForListing("cargo-list", state.value.type, state.value.kpi),
);

/* ------------------------------------------------------------ click-to-filter
 * Filters are applied by clicking a value inside a row. Each clickable maps
 * to a store field; `setFilter` writes it and reloads page 1. The active set
 * is surfaced as removable chips (ActiveFilterChips) above the table.
 *
 * Only string column-filters that the row actually carries are wired here —
 * we never invent an id we don't have (e.g. client filters by free-text
 * `search`, which the backend LIKEs over rag_soc).
 */
const COLUMN_FILTER_FIELDS = [
  "search",
  "RIF_cliente",
  "terminal_part",
  "terminal_dest",
  "airline_code",
] as const;
type ColumnFilterField = (typeof COLUMN_FILTER_FIELDS)[number];

/** i18n key per field, for the chip's "group" prefix (resolved via t()). */
const FILTER_GROUP_KEY: Record<ColumnFilterField, string> = {
  search: "filters.group.search",
  RIF_cliente: "filters.group.rif",
  terminal_part: "filters.cargo.group.origin_term",
  terminal_dest: "filters.cargo.group.dest_term",
  airline_code: "filters.group.carrier",
};

function setFilter(
  field: ColumnFilterField,
  value: string,
  _group: string,
  iso?: string,
): void {
  const v = (value ?? "").trim();
  if (!v) return;
  store.applyState({ [field]: v, page: 1 });
  void store.fetchPage();
  // `iso` is carried only so the chip can show a flag; the row already
  // knows the country, so we stash it for the chip descriptor.
  if (iso) flagHints.value[field] = iso;
}

/**
 * "Ver todo de este cliente". Filtra por `id_cliente` (columna indexada) en
 * vez de por el nombre vía `search`, que hace LIKE sobre varias tablas.
 * Si la fila no trae id se recurre al nombre para no dejar el clic muerto.
 */
function filterByClient(row: CargoListRow): void {
  if (row.id_cliente) {
    store.applyState({
      id_cliente: String(row.id_cliente),
      search: "",
      page: 1,
    });
    clientNameHints.value[String(row.id_cliente)] = row.cliente;
    void store.fetchPage();
    return;
  }
  setFilter("search", row.cliente, "Client");
}

/** Nombre legible por id de cliente, para el chip de filtro activo. */
const clientNameHints = ref<Record<string, string>>({});

/**
 * Lane filter (origin/destination). `side` is 'part' (origin) or 'dest'
 * (destination); `axis` is 'terminal' (airport code → terminal_part/_dest)
 * or 'country' (ISO → paesex + cerca_pd P/D).
 *
 * Country uses the legacy `paesex`/`cerca_pd` pair, which only targets ONE
 * side at a time — applying a destination country replaces an origin one.
 */
function setLaneFilter(
  side: "part" | "dest",
  axis: "terminal" | "country",
  value: string,
): void {
  const v = (value ?? "").trim();
  if (!v) return;
  if (axis === "terminal") {
    const field = side === "part" ? "terminal_part" : "terminal_dest";
    store.applyState({ [field]: v, page: 1 });
  } else {
    // country: paesex + cerca_pd (P/D). Single-sided by backend design.
    const pd = side === "part" ? "P" : "D";
    store.applyState({ paesex: v.toUpperCase(), cerca_pd: pd, page: 1 });
    flagHints.value.paesex = v.toUpperCase();
  }
  void store.fetchPage();
}

/** ISO hint per field so lane chips can render a flag (set on click). */
const flagHints = ref<Record<string, string>>({});

/** Human label for the active date range chip. "= day" when both bounds match. */
const dateRangeLabel = computed<string>(() => {
  const from = state.value.date_from;
  const to = state.value.date_to;
  if (from && to)
    return from === to ? from : t("filters.value.date_range", { from, to });
  if (from) return t("filters.value.date_from", { date: from });
  return t("filters.value.date_until", { date: to });
});

const activeFilters = computed<ActiveFilter[]>(() => {
  const out: ActiveFilter[] = [];
  for (const field of COLUMN_FILTER_FIELDS) {
    const value = (state.value as Record<string, unknown>)[field];
    if (typeof value === "string" && value !== "") {
      out.push({
        field,
        group: t(FILTER_GROUP_KEY[field]),
        value,
        iso: flagHints.value[field],
      });
    }
  }
  // Cliente (id_cliente): filtro que aplica el clic en el nombre de cliente.
  // Sin chip el listado quedaría acotado sin forma de volver atrás.
  if (state.value.id_cliente) {
    out.push({
      field: "id_cliente",
      group: t("filters.group.client"),
      value:
        clientNameHints.value[String(state.value.id_cliente)] ||
        String(state.value.id_cliente),
    });
  }
  // Country (paesex + cerca_pd). One chip, labelled by side (origin/dest),
  // with the flag rendered from the ISO.
  if (state.value.paesex && state.value.cerca_pd) {
    out.push({
      field: "paesex",
      group:
        state.value.cerca_pd === "P"
          ? t("filters.group.origin_country")
          : t("filters.group.dest_country"),
      value: state.value.paesex,
      iso: state.value.paesex,
    });
  }
  // Date range (set via the topbar popover OR by clicking a row's
  // Created time). A single chip covers both bounds so removing it
  // clears the whole range.
  if (state.value.date_from || state.value.date_to) {
    out.push({
      field: "date_range",
      group: t("filters.group.date"),
      value: dateRangeLabel.value,
    });
  }
  // Unread-chat filter (entered from the platform chat badge). Without a chip
  // the listing looks arbitrarily truncated with no way back to the full list.
  if (state.value.chat_unread) {
    out.push({
      field: "chat_unread",
      group: t("filters.group.chat_unread"),
      value: t("filters.value.chat_unread_yes"),
    });
  }
  // Home-tile deep-link (e.g. ?type=clwt) appears as a chip too, so the
  // operator can drop it the same way as a column filter.
  if (activeHomeKpi.value) {
    out.push({
      field: "type",
      group: kpiGroupLabel(t, activeHomeKpi.value.group),
      value: kpiLabel(t, activeHomeKpi.value),
      color:
        activeHomeKpi.value.variant === "error"
          ? "error"
          : activeHomeKpi.value.variant === "warning"
            ? "warning"
            : activeHomeKpi.value.variant === "success"
              ? "success"
              : "primary",
    });
  }
  for (const def of CARGO_ADVANCED_CHIPS) {
    const value = String(state.value[def.field] ?? "");
    if (!value) continue;
    out.push({
      field: def.field,
      group: t(def.label),
      value: def.yesNo ? t("common.yes") : value,
    });
  }
  return out;
});

const CARGO_ADVANCED_CHIPS: Array<{
  field: keyof typeof state.value;
  label: string;
  yesNo?: boolean;
}> = [
  { field: "id", label: "filters.cargo.fields.cargo_id" },
  { field: "AWB_forn", label: "filters.cargo.fields.mawb" },
  { field: "note", label: "filters.fields.notes" },
  { field: "gestione", label: "filters.cargo.fields.management_state" },
  { field: "offerta", label: "filters.cargo.fields.offer_state" },
  { field: "tipo_merce", label: "filters.cargo.fields.cargo_type" },
  { field: "vettore_tipo", label: "filters.cargo.fields.carrier_type" },
  { field: "flight_num1", label: "filters.cargo.fields.flight_num" },
  { field: "cargo_dazi", label: "filters.cargo.fields.duty_indicator" },
  { field: "controllata", label: "filters.fields.controlled" },
  { field: "archiviata", label: "filters.fields.archived" },
  { field: "consegna_firma", label: "filters.fields.delivered" },
  { field: "peso_da", label: "filters.fields.weight_from" },
  { field: "peso_a", label: "filters.fields.weight_to" },
  { field: "pesor", label: "filters.cargo.fields.chargeable_weight" },
  { field: "has_assicurazione", label: "filters.fields.has_insurance", yesNo: true },
  { field: "acc_dryice", label: "filters.cargo.fields.dry_ice", yesNo: true },
  { field: "acc_danggoods", label: "filters.cargo.fields.dangerous_goods", yesNo: true },
  { field: "acc_bancale", label: "filters.cargo.fields.palletised", yesNo: true },
];

function removeFilter(field: string): void {
  if (field === "type") {
    store.applyState({ type: "all", kpi: "", page: 1 });
  } else if (field === "date_range") {
    store.applyState({ date_from: "", date_to: "", page: 1 });
  } else if (field === "paesex") {
    store.applyState({ paesex: "", cerca_pd: "", page: 1 });
    delete flagHints.value.paesex;
  } else {
    store.applyState({ [field]: "", page: 1 });
    delete flagHints.value[field];
  }
  void store.fetchPage();
}

function clearAllFilters(): void {
  store.applyState(cargoResetFilters(state.value));
  flagHints.value = {};
  clientNameHints.value = {};
  void store.fetchPage();
}

const filterPanelOpen = ref(false);
const toasts = useToastStore();

/**
 * Bulk-selected rows. Vuetify v-data-table-server emits an array of
 * objects (return-object) — we keep them as CargoListRow[] for richer UX
 * (e.g. showing client names in confirmation dialogs in future fases).
 */
const selected = ref<CargoListRow[]>([]);
const bulkBusy = ref(false);
const selectedIds = computed<number[]>(() => selected.value.map((r) => r.id));

/**
 * Params handed to the export endpoint — the very same ones the listing sends,
 * minus pagination.
 *
 * The backend runs them through Cargo_Shipments_Request_Handler, the same path
 * the on-screen listing takes, so the file covers exactly what is on screen.
 * Pagination is dropped on purpose: an export covers the whole result set, not
 * the page being viewed.
 */
const exportParams = computed<Record<string, unknown>>(() => {
  const {
    page: _page,
    per_page: _perPage,
    ...rest
  } = buildCargoListQuery(state.value);
  return rest as Record<string, unknown>;
});

async function onBulkArchive(): Promise<void> {
  if (!selectedIds.value.length) return;
  bulkBusy.value = true;
  try {
    const r = await cargoListService.bulkArchive(selectedIds.value);
    if (r.success) {
      toasts.push(
        "success",
        t("listing.toast.archived", selectedIds.value.length),
      );
      selected.value = [];
      void store.fetchPage();
    } else {
      toasts.push("error", r.error || t("listing.toast.archive_failed"));
    }
  } catch (err) {
    toasts.push("error", (err as Error).message);
  } finally {
    bulkBusy.value = false;
  }
}

async function onBulkControl(): Promise<void> {
  if (!selectedIds.value.length) return;
  bulkBusy.value = true;
  try {
    const r = await cargoListService.bulkControl(selectedIds.value);
    if (r.success) {
      toasts.push(
        "success",
        t("listing.toast.marked_controlled", selectedIds.value.length),
      );
      selected.value = [];
      void store.fetchPage();
    } else {
      toasts.push("error", r.error || t("listing.toast.control_failed"));
    }
  } catch (err) {
    toasts.push("error", (err as Error).message);
  } finally {
    bulkBusy.value = false;
  }
}

/** Count of "advanced" filters active (those exposed only via the drawer). */
const advancedFilterCount = computed<number>(() => {
  return cargoActiveFilterCount(state.value);
});

/**
 * Sync state → URL with router.replace so the back stack stays usable.
 * `urlSyncSuppressed` blocks the watcher while we are applying an incoming URL.
 */
let urlSyncSuppressed = false;

function syncStateToUrl(): void {
  if (urlSyncSuppressed) return;
  const next = serializeCargoListQuery(state.value);
  // `view` (registro abierto en el drawer) NO es un filtro, asi que
  // `serializeCargoListQuery` no lo incluye y hay que re-adjuntarlo aqui, o
  // cualquier re-sincronizacion del listado lo borraria de la URL.
  // Se lee de `openViewId` y no de `route.query.view` porque vue-router
  // actualiza `route` de forma asincrona: este watcher puede correr con la
  // ruta anterior, cuando `view` todavia no esta en la query.
  if (openViewId.value != null) next.view = String(openViewId.value);
  next.work_view = activeWorkView.value.id;
  // Avoid creating identical history entries.
  const cur = route.query;
  const sameKeys =
    Object.keys(next).length === Object.keys(cur).length &&
    Object.entries(next).every(([k, v]) => String(cur[k] ?? "") === v);
  if (sameKeys) return;
  router.replace({ query: next });
}

function syncUrlToState(): void {
  const parsed = parseCargoListQuery(route.query as Record<string, unknown>);
  urlSyncSuppressed = true;
  store.applyState(parsed);
  urlSyncSuppressed = false;
}

function onFilterChange(): void {
  state.value.page = 1;
  void store.fetchPage();
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
  store.applyState({
    date_from: localIsoDate(from),
    date_to: localIsoDate(to),
    page: 1,
  });
  void store.fetchPage();
}

/**
 * Registro abierto en el drawer, en estado LOCAL.
 *
 * Es la fuente de verdad sincrona: `route.query.view` solo existe despues de
 * que vue-router resuelva la navegacion, y los watchers de sincronizacion
 * (`syncStateToUrl`) pueden correr antes de eso. Manteniendo el id aqui, la
 * URL y el drawer nunca discrepan.
 */
const openViewId = ref<number | null>(null);

/**
 * Marca de tiempo de la ultima apertura. `v-navigation-drawer` con `temporary`
 * cierra al detectar un clic fuera, y el propio clic que abre el drawer sigue
 * burbujeando cuando el panel ya esta montado: Vuetify lo lee como
 * "clic fuera" y emite `update:model-value=false` de inmediato. Ese falso
 * cierre es el que borraba `?view=` y dejaba el drawer invisible.
 */
let lastOpenAt = 0;

function openCargo(id: string | number): void {
  lastOpenAt = performance.now();
  openViewId.value = Number(id);
  void router.replace({ query: { ...route.query, view: String(id) } });
}

/** Lee `?view=` de la URL y devuelve el id, o null si no es valido. */
function parseViewId(raw: unknown): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * La URL alimenta el estado SOLO cuando trae un id (deep-link, atras/adelante,
 * prev/next del navegador de registros).
 *
 * NO se cierra el drawer cuando `view` desaparece de la URL: `syncStateToUrl`
 * reescribe la query cada vez que cambia el estado del listado, y en esa
 * reescritura `view` puede perderse un instante. Si aqui se hiciera
 * `openViewId = null`, ese parpadeo cerraria el drawer de forma permanente
 * (era exactamente el bug: la URL revertia a `/cargo/list` sin `view`).
 * El cierre es siempre explicito, via `setDrawerOpen(false)`.
 */
watch(
  () => route.query.view,
  (raw) => {
    const fromUrl = parseViewId(raw);
    if (fromUrl != null && fromUrl !== openViewId.value) {
      openViewId.value = fromUrl;
    }
  },
  { immediate: true },
);

/**
 * Reinstala `?view=` si una reescritura de la query lo dejo fuera mientras el
 * drawer sigue abierto. Cubre el caso en que `syncStateToUrl` corra con la
 * ruta antigua: la URL vuelve a reflejar el registro abierto, de modo que el
 * enlace se puede copiar y la recarga mantiene el drawer.
 */
watch(
  () => [route.query.view, openViewId.value] as const,
  ([raw, open]) => {
    if (open == null) return;
    if (parseViewId(raw) === open) return;
    void router.replace({ query: { ...route.query, view: String(open) } });
  },
);

const viewId = computed<number | null>(() => openViewId.value);

const drawerOpen = computed<boolean>(() => viewId.value != null);

function setDrawerOpen(open: boolean): void {
  if (open) return;
  // Ignora el cierre espurio que Vuetify emite en cuanto se monta el drawer:
  // el clic que lo abrio sigue propagandose y `temporary` lo interpreta como
  // clic-fuera. Un cierre real del usuario (boton, Esc, velo) siempre llega
  // mucho despues de esa ventana.
  if (performance.now() - lastOpenAt < 400) return;
  openViewId.value = null;
  if (route.query.view == null) return;
  const query = { ...route.query };
  delete query.view;
  void router.replace({ query });
}

/** URL absoluta del detalle cargo en el form legacy (winbody pp=spedyc). */
function legacyDetailHref(id: string | number): string {
  return `/erp/winbody.php?pp=spedyc&id=${encodeURIComponent(String(id))}`;
}

function serializeFilterKey(): string {
  const q = serializeCargoListQuery(state.value);
  return Object.keys(q)
    .sort()
    .map((k) => `${k}=${q[k]}`)
    .join("&");
}

function formatDate(s: string | null | undefined): string {
  if (!s || s === "0000-00-00" || s === "0000-00-00 00:00:00") return "—";
  return s.length > 10 ? s.slice(0, 16) : s;
}

/** Empty-date guard shared by the time/day helpers. */
function isEmptyDate(s: string | null | undefined): s is null | undefined | "" {
  return !s || s === "0000-00-00" || s === "0000-00-00 00:00:00";
}

/** "2026-06-01 14:32:00" → "2026-06-01". Shown in Created + used as the day filter value. */
function dayOf(s: string | null | undefined): string {
  if (isEmptyDate(s)) return "";
  return (s as string).slice(0, 10);
}

/**
 * Filter to the single day a row was created. Sets date_from = date_to =
 * that day; the backend turns date_to into `<= day 23:59:59`, so the
 * effective window is 00:00:00 → 23:59:59 of that day.
 */
function filterByDay(s: string | null | undefined): void {
  const day = dayOf(s);
  if (!day) return;
  store.applyState({ date_from: day, date_to: day, page: 1 });
  void store.fetchPage();
}

function statusBadges(
  item: CargoListRow,
): Array<{ label: string; color: string }> {
  const out: Array<{ label: string; color: string }> = [];
  // Legacy sentinel date "0000-00-00 …" means "unset"; isEmptyDate centralises
  // that check so it isn't repeated as an inline literal across the component.
  const delivered = !isEmptyDate(item.dates.delivered);
  const inFlight = !isEmptyDate(item.dates.flight_departure) && !delivered;

  // item.status.label comes from the backend — rendered as-is (not i18n'd).
  if (item.status.label) {
    out.push({
      label: item.status.label,
      color: item.status.color || "default",
    });
  } else if (delivered) {
    out.push({ label: t("enums.cargo_status.delivered"), color: "success" });
  } else if (inFlight) {
    out.push({ label: t("enums.cargo_status.in_flight"), color: "info" });
  } else if (item.awb) {
    out.push({ label: t("enums.cargo_status.booked"), color: "primary" });
  } else {
    out.push({ label: t("enums.cargo_status.draft"), color: "default" });
  }
  if (item.archived) {
    out.push({ label: t("enums.cargo_status.archived"), color: "default" });
  }
  return out;
}

// State → URL (skips re-emits while applying URL changes).
watch(() => state.value, syncStateToUrl, { deep: true });
/**
 * URL -> state (back/forward/enlaces externos), IGNORANDO `view`.
 *
 * `view` es el registro abierto en el drawer, no un filtro. Observando
 * `route.query` entero, abrir el drawer (que solo anade `?view=`) disparaba
 * `syncUrlToState` -> `applyState` -> reemplazo de `state.value` -> el watch
 * `deep` de arriba -> `syncStateToUrl`, que reescribia la query y cerraba el
 * drawer recien abierto. Se observa la query SIN `view`.
 */
watch(() => {
  const { view: _view, ...filters } = route.query;
  return JSON.stringify(filters);
}, syncUrlToState);

/**
 * Recalcula los KPI cuando cambia el filtro — no al paginar, reordenar ni
 * cambiar de tile, que no alteran el conjunto contado.
 */
watch(
  () => {
    const { page, per_page, sort, sort_dir, type, ...filters } =
      buildCargoListQuery(state.value);
    return JSON.stringify(filters);
  },
  () => {
    void refreshKpiCounts();
  },
);

async function enterList(): Promise<void> {
  syncUrlToState();
  await store.fetchPage();
  // Después del listado: los KPI son secundarios.
  void refreshKpiCounts();

  // If we returned via "Torna alla lista" the URL carries `restore=1`.
  if (route.query.restore === "1") {
    const ctx = loadListContext("cargo-list");
    if (ctx && ctx.filterKey === serializeFilterKey()) {
      restoreListScroll(ctx);
    }
    clearListContext("cargo-list");
    const cleaned = { ...route.query };
    delete (cleaned as Record<string, unknown>).restore;
    void router.replace({ query: cleaned });
  }
}

// ME1: bajo <KeepAlive> (ver OperationsShell.vue), volver de un detalle ya
// NO remonta la página — reactiva la instancia existente. `onMounted` sigue
// cubriendo la primera carga real (y deja al componente funcionar standalone
// fuera de un KeepAlive, p.ej. en un test); `onActivated` repite la carga en
// cada reactivación para no mostrar datos obsoletos si algo cambió en el
// detalle (p.ej. un estado editado). `hasMountedOnce` evita duplicar el
// fetch en la activación inicial: Vue dispara `activated` también la
// primera vez que un componente se inserta dentro de un KeepAlive, justo
// después de `mounted`.
let hasMountedOnce = false;

onMounted(async () => {
  hasMountedOnce = true;
  await enterList();
});

onActivated(() => {
  if (!hasMountedOnce) return;
  void enterList();
});

// Leaving the listing: cancel the in-flight page and clear any stale error.
// Without this the request keeps running against a page nobody is looking at,
// and because the store is a module singleton its error would be rendered
// again on the next mount. onDeactivated cubre la ida a un detalle bajo
// KeepAlive (no dispara onBeforeUnmount); onBeforeUnmount sigue cubriendo un
// desmontaje real (fuera de KeepAlive, o si se saca del include).
onBeforeUnmount(() => {
  store.cancelInFlight();
});

onDeactivated(() => {
  store.cancelInFlight();
});
</script>

<style scoped>
.font-mono {
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.875em;
}

/* Origin/Destination cell — flag (filters country) + terminal code
   (filters terminal), each independently clickable. */
.route-endpoint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.route-flag {
  display: inline-flex;
  align-items: center;
  line-height: 0;
  padding: 2px;
  margin: -2px;
  border-radius: 5px;
}
.route-flag:disabled {
  cursor: default;
}

/* ── Filterable values ──────────────────────────────────────────────
   Any row value that applies a column filter on click. Rendered as a
   bare <button> so it's keyboard-accessible, but styled to read as
   inline text until hovered, when it reveals it's actionable. */
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

/* ── Topbar date popover ── */
.topbar-iconbtn--active {
  color: rgb(var(--v-theme-primary));
  border-color: rgba(var(--v-theme-primary), 0.5);
}
.topbar-datepop {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  min-width: 220px;
  margin-top: 6px;
}
.date-presets {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
