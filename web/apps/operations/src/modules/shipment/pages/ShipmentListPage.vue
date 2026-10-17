<template>
  <!--
    Dashboard layout: fixed top bar + collapsible sidebar + main content.
    See frontend/shared/listing/DashboardShell.vue for the grid layout.
  -->
  <div class="shipment-v2" :data-theme="ui.v2Theme">
    <DashboardShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
      <template #topbar-title>
        <button
          type="button"
          class="topbar-iconbtn dsh-brand-btn"
          :title="t('listing.shipment.title_back')"
          @click="onTitleClick"
        >
          <v-icon icon="mdi-package-variant-closed" size="18" />
        </button>
        <div class="hblock">
          <div class="topbar-shipnum">{{ t("listing.shipment.title") }}</div>
          <div class="topbar-hmeta">
            {{ t("listing.total", { count: totalFormatted }) }}
          </div>
        </div>
      </template>

      <template #topbar-actions>
        <!-- Date range in the topbar. Column filters (client, service,
             country, status) are applied by clicking values in the rows
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
          :views="SHIPMENT_WORK_VIEWS"
          :label="t('listing.work_view.label')"
        />
        <ViewModeToggle v-model="viewMode" />
        <ShipmentExportMenu
          :selected-ids="selectedIds"
          :params="exportParams"
          type="express"
        />
        <button
          type="button"
          class="topbar-iconbtn"
          :title="t('listing.shipment.recharge_title')"
          @click="openRecharge"
        >
          <v-icon icon="mdi-cash-clock" size="18" />
        </button>
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

      <template #sidebar="{ collapsed }">
        <!-- Menú universal (el mismo de #/home y del detalle), sustituye a
             PlatformSidebar vía `hide-platform-nav`. El rail de KPIs va debajo. -->
        <OperationsNav :collapsed="collapsed" />

        <ListingKpiStrip
          :tiles="kpiTiles"
          :active="state.type"
          direction="column"
          :rail="collapsed"
          @select="onKpiSelect"
        />
      </template>

      <ShipmentFilterPanel v-model="filterPanelOpen" />

      <!-- Active filters — removable chips for everything applied via
             click-to-filter (client, service, country, status) plus the
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
          icon="mdi-package-variant-closed-remove"
          :title="t('listing.shipment.empty_title')"
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
        @update:selected="(v) => (selected = v as ShipmentListRow[])"
        @update:mode="(v) => (viewMode = v)"
        @row-click="(row) => openShipment((row as ShipmentListRow).id)"
      >
        <template #bulk-actions="{ selectedIds: ids }">
          <v-btn
            v-if="hasBulkAction('tracking')"
            variant="text"
            prepend-icon="mdi-radar"
            :loading="bulkBusy"
            @click="onBulkTracking"
          >
            {{ t("listing.bulk.launch_tracking", { count: ids.length }) }}
          </v-btn>
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
          <span class="font-mono">{{ (item as ShipmentListRow).id }}</span>
        </template>
        <template #cell.cliente="{ item }">
          <div class="text-body-2">
            <!-- Filtra por `id_cliente` (indexado, ~15 ms), NO por el nombre
                 vía `search`: esa búsqueda libre hace LIKE '%…%' sobre 3 tablas
                 y tardaba hasta 23 s para el mismo resultado. -->
            <button
              v-if="(item as ShipmentListRow).cliente"
              type="button"
              class="filterable font-weight-medium text-truncate"
              style="max-width: 260px"
              :title="t('filters.click.by_client')"
              @click.stop="filterByClient(item as ShipmentListRow)"
            >
              {{ (item as ShipmentListRow).cliente }}
            </button>
            <span v-else class="text-medium-emphasis">—</span>
            <button
              v-if="(item as ShipmentListRow).servizio"
              type="button"
              class="filterable text-caption text-medium-emphasis"
              :title="t('filters.shipment.click.by_service')"
              @click.stop="
                setFilter(
                  'search',
                  (item as ShipmentListRow).servizio,
                  'Service',
                )
              "
            >
              {{ (item as ShipmentListRow).servizio }}
            </button>
          </div>
        </template>
        <template #cell.awb="{ item }">
          <span
            v-if="(item as ShipmentListRow).awb"
            class="font-mono text-body-2"
            >{{ (item as ShipmentListRow).awb }}</span
          >
          <span v-else class="text-medium-emphasis">—</span>
        </template>
        <template #cell.origin="{ item }">
          <div class="dest-cell">
            <button
              type="button"
              class="filterable dest-flag-btn"
              :title="
                (item as ShipmentListRow).origin.country
                  ? t('filters.click.origin_country', {
                      v: (item as ShipmentListRow).origin.country,
                    })
                  : ''
              "
              :disabled="!(item as ShipmentListRow).origin.country"
              @click.stop="
                setLaneFilter('P', (item as ShipmentListRow).origin.country)
              "
            >
              <CountryFlag
                :iso="(item as ShipmentListRow).origin.country"
                :size="18"
              />
            </button>
            <div class="dest-text">
              <div class="text-body-2 text-truncate" style="max-width: 150px">
                {{
                  (item as ShipmentListRow).origin.name ||
                  (item as ShipmentListRow).origin.city ||
                  "—"
                }}
              </div>
              <!-- Solo la ciudad: el país ya lo comunica la bandera de la
                   izquierda, repetir el ISO aquí era ruido. -->
              <div class="text-caption text-medium-emphasis">
                {{ (item as ShipmentListRow).origin.city || "" }}
              </div>
            </div>
          </div>
        </template>
        <template #cell.destination="{ item }">
          <div class="dest-cell">
            <button
              type="button"
              class="filterable dest-flag-btn"
              :title="
                (item as ShipmentListRow).destination.country
                  ? t('filters.click.dest_country', {
                      v: (item as ShipmentListRow).destination.country,
                    })
                  : ''
              "
              :disabled="!(item as ShipmentListRow).destination.country"
              @click.stop="
                setLaneFilter(
                  'D',
                  (item as ShipmentListRow).destination.country,
                )
              "
            >
              <CountryFlag
                :iso="(item as ShipmentListRow).destination.country"
                :size="18"
              />
            </button>
            <div class="dest-text">
              <div class="text-body-2 text-truncate" style="max-width: 150px">
                {{ (item as ShipmentListRow).destination.name || "—" }}
              </div>
              <!-- Solo la ciudad: el país lo comunica la bandera. -->
              <div class="text-caption text-medium-emphasis">
                {{ (item as ShipmentListRow).destination.city || "" }}
              </div>
            </div>
          </div>
        </template>
        <template #cell.created="{ item }">
          <button
            type="button"
            class="filterable text-body-2"
            :title="
              (item as ShipmentListRow).dates.created
                ? t('filters.click.by_day', {
                    v: dayOf((item as ShipmentListRow).dates.created),
                  })
                : ''
            "
            :disabled="!(item as ShipmentListRow).dates.created"
            @click.stop="filterByDay((item as ShipmentListRow).dates.created)"
          >
            {{ dayOf((item as ShipmentListRow).dates.created) || "—" }}
          </button>
        </template>
        <template #cell.status="{ item }">
          <v-chip
            v-for="b in statusBadges(item as ShipmentListRow)"
            :key="b.label"
            :color="b.color"
            size="x-small"
            variant="tonal"
            class="me-1"
          >
            {{ b.label }}
          </v-chip>
        </template>
        <template #cell.packages="{ item }">
          <span class="text-body-2">{{
            (item as ShipmentListRow).packages || 0
          }}</span>
        </template>
        <template #cell.weight="{ item }">
          <span class="text-body-2"
            >{{
              Number(
                (item as ShipmentListRow).weight.charged ??
                  (item as ShipmentListRow).weight.real ??
                  0,
              ).toFixed(1)
            }}
            kg</span
          >
        </template>
        <template #cell.actions="{ item }">
          <div class="d-inline-flex align-center">
            <v-btn
              icon="mdi-radar"
              size="x-small"
              variant="text"
              :loading="trackingId === (item as ShipmentListRow).id"
              :title="t('listing.launch_tracking')"
              @click.stop="onLaunchTracking((item as ShipmentListRow).id)"
            />
            <v-btn
              icon="mdi-eye-outline"
              size="x-small"
              variant="text"
              :title="t('listing.open_modern')"
              @click.stop="openShipment((item as ShipmentListRow).id)"
            />
            <v-btn
              :href="legacyDetailHref((item as ShipmentListRow).id)"
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

    <ShipmentDetailOverlay
      :model-value="drawerOpen"
      :view-id="viewId"
      @update:model-value="setDrawerOpen"
    />
  </div>
</template>

<script setup lang="ts">
import { detailHref as spaDetailHref } from "@shared/platform/navTargets";
import EmptyState from "@shared/ui/EmptyState.vue";
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter, useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import {
  shipmentService,
  shipmentListService,
  type ShipmentListRow,
} from "@shipment/services/shipment.service";
import {
  useShipmentListStore,
  parseShipmentListQuery,
  serializeShipmentListQuery,
  buildShipmentListQuery,
  shipmentActiveFilterCount,
  shipmentResetFilters,
} from "@shipment/stores/shipment_list.store";
import { useToastStore } from "@shipment/stores/toast.store";
import { useUiStore } from "@shipment/stores/ui.store";
import ShipmentFilterPanel from "@shipment/components/shipment/ShipmentFilterPanel.vue";
import ShipmentExportMenu from "@shipment/components/shipment/ShipmentExportMenu.vue";
import ShipmentDetailOverlay from "@shipment/components/shipment/ShipmentDetailOverlay.vue";
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
import ListingKpiStrip from "@shared/listing/ListingKpiStrip.vue";
import type { KpiTileDescriptor } from "@shared/listing/ListingKpiStrip.vue";
import type { ActiveFilter } from "@shared/listing/types";
import {
  findKpiForListing,
  kpiGroupLabel,
  kpiLabel,
} from "@shared/dashboard/home_kpi_catalog";
import {
  loadListContext,
  clearListContext,
  restoreListScroll,
} from "@shared/listing/useListContext";
import { useListViewMode } from "@shared/listing/useListViewMode";
import type { ListSource, DataTableHeader } from "@shared/listing/types";
import {
  SHIPMENT_WORK_VIEWS,
  shipmentDefaultWorkView,
} from "@shipment/listing/shipment-work-views";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const store = useShipmentListStore();
const ui = useUiStore();
const { state, rows, total, loading, error } = storeToRefs(store);

/**
 * View mode shared with the cargo SPA via a single localStorage key, so the
 * user's preference (Pages vs Scroll) carries across both lists.
 */
const viewMode = useListViewMode("tmwe:list-view-mode", "paginated");

const dataSource = computed<ListSource<ShipmentListRow>>(() => ({
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

/** Title click — scroll table back to top (single-page list, no other navigation). */
function onTitleClick(): void {
  state.value.page = 1;
  void store.fetchPage();
}

/**
 * KPI tiles for the express dashboard. Tile keys MUST match
 * `ShipmentListUrlState['type']` so clicking applies that filter.
 * Inactive tiles show '—' for now; a dedicated count endpoint can
 * populate them without changing this UI in a future fase.
 */
/**
 * Contadores de los KPI que NO son el activo. Antes mostraban siempre "—"
 * (un rail donde 3 de 4 cifras son em-dash no informa). El backend los
 * resuelve barato — medido 0,13-0,7 s por tipo — así que se piden en
 * paralelo con `per_page=1`: solo interesa `pagination.total`.
 *
 * Deliberadamente NO pasa por el store: éste comparte un único
 * AbortController con el listado, y pedir los KPIs por ahí cancelaría la
 * página que el operador está viendo.
 */
const kpiCounts = ref<Record<string, number>>({});

const KPI_KEYS = ["in_transit", "cod_pending", "pickup_status"] as const;

async function refreshKpiCounts(): Promise<void> {
  const base = buildShipmentListQuery(state.value);
  await Promise.all(
    KPI_KEYS.map(async (key) => {
      try {
        const r = await shipmentListService.fetch({
          ...base,
          type: key,
          page: 1,
          per_page: 1,
        });
        kpiCounts.value[key] = r.pagination?.total ?? 0;
      } catch {
        // Un KPI que no responde vuelve a "—"; nunca rompe el listado.
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
    caption: t("listing.shipment.kpi.all"),
    value: total.value,
  },
  {
    key: "in_transit",
    icon: "mdi-truck-fast",
    caption: t("listing.shipment.kpi.in_transit"),
    value: kpiValue("in_transit"),
    sub: t("listing.shipment.kpi.in_transit_sub"),
    variant: "success",
  },
  {
    key: "cod_pending",
    icon: "mdi-cash-clock",
    caption: t("listing.shipment.kpi.cod_pending"),
    value: kpiValue("cod_pending"),
    sub: t("listing.shipment.kpi.cod_pending_sub"),
    variant: "warning",
  },
  {
    key: "pickup_status",
    icon: "mdi-package-up",
    caption: t("listing.shipment.kpi.pickup_status"),
    value: kpiValue("pickup_status"),
    sub: t("listing.shipment.kpi.pickup_status_sub"),
  },
]);

function onKpiSelect(key: string): void {
  if (key === state.value.type) return;
  // The store's `normalisedType` will keep us safe if some unknown key
  // arrives — it falls back to `all`. So we don't need a hardcoded
  // whitelist here.
  store.applyState({ type: key, kpi: "", page: 1 });
  void store.fetchPage();
}

function onRefresh(): void {
  void store.fetchPage();
}

/**
 * Symbolic header keys for slot rendering. Sort fields are mapped via
 * SORT_KEY_MAP. Backend whitelist: Shipments_List_Request_Handler::ALLOWED_SORT_FIELDS.
 */
const allHeaders = computed<DataTableHeader[]>(() => [
  { title: t("listing.headers.id"), key: "id", width: 130 },
  { title: t("listing.headers.client"), key: "cliente" },
  { title: t("listing.shipment.headers.awb_tracking"), key: "awb", width: 190 },
  { title: t("listing.headers.origin"), key: "origin", width: 180 },
  { title: t("listing.headers.destination"), key: "destination", width: 180 },
  { title: t("listing.headers.created"), key: "created", width: 130 },
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
    SHIPMENT_WORK_VIEWS,
    route.query.work_view,
    state.value.type,
    shipmentDefaultWorkView(state.value.type),
  ),
);

const workViewId = computed({
  get: () => activeWorkView.value.id,
  set: (value: string) => {
    const resolved = resolveWorkView(
      SHIPMENT_WORK_VIEWS,
      value,
      state.value.type,
      shipmentDefaultWorkView(state.value.type),
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
 * Origin/destination sort by their country (spi/spi2.id_paese_iso). The JOIN
 * is pulled into the ORDER BY by Smart_Query_Builder::get_sort_required_joins.
 */
const SORT_KEY_MAP: Record<string, NonNullable<typeof state.value.sort>> = {
  id: "sp.id",
  cliente: "ang.rag_soc",
  awb: "sp.AWB_forn",
  origin: "spi.id_paese_iso",
  destination: "spi2.id_paese_iso",
  created: "sp.data_sped1",
  packages: "sp.colli",
  weight: "sp.peso_tassato",
};

const totalFormatted = computed(() => total.value.toLocaleString("en-US"));

/**
 * If we arrived via a home-tile deep-link (e.g. `?type=dacontr`), look
 * up the catalog descriptor so the chip can show the same label/icon/
 * variant the home tile used. Returns null for plain macro types
 * (`all`, `in_transit`, …) — the strip already highlights those.
 */
const activeHomeKpi = computed(() =>
  findKpiForListing("shipment-list", state.value.type, state.value.kpi),
);

/* ------------------------------------------------------------ click-to-filter
 * Filters are applied by clicking a value inside a row. Each clickable maps
 * to a store field; `setFilter` writes it and reloads page 1. The active set
 * is surfaced as removable chips (ActiveFilterChips) above the table.
 *
 * Only fields the row actually carries are wired: client + service filter via
 * free-text `search` (the backend LIKEs it over rag_soc/service name), and
 * destination filters via `country_iso`.
 */
// `country_iso` is handled separately (it pairs with location_type to show
// origin/dest), so it's not in the generic column-filter loop.
const COLUMN_FILTER_FIELDS = ["search"] as const;
type ColumnFilterField = (typeof COLUMN_FILTER_FIELDS)[number];

const FILTER_GROUP_KEY: Record<ColumnFilterField, string> = {
  search: "filters.group.search",
};

/** ISO hint per field so the country chip can render a flag (set on click). */
const flagHints = ref<Record<string, string>>({});

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
  if (iso) flagHints.value[field] = iso;
}

/**
 * "Ver todo de este cliente". Filtra por `id_cliente`, que es una columna
 * indexada: ~15 ms frente a los hasta 23 s del `search` de texto libre, que
 * hace `LIKE '%nombre%'` sobre AWB, referencia, ambas direcciones y la
 * anagrafica, arrastrando tres JOIN (dos de ellos con subconsulta MAX()).
 *
 * Si la fila no trae id (dato antiguo, cliente borrado) se recurre al nombre
 * para no dejar el clic muerto.
 */
function filterByClient(row: ShipmentListRow): void {
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

/**
 * Nombre legible por id de cliente, para que el chip de filtro activo muestre
 * "Cliente: OHB Italia SPA" en vez del id crudo.
 */
const clientNameHints = ref<Record<string, string>>({});

/**
 * Lane country filter. `side` is 'P' (origin) or 'D' (destination). Uses the
 * backend's country_iso + location_type pair, which only targets ONE side at
 * a time — applying a destination country replaces an origin one.
 */
function setLaneFilter(side: "P" | "D", country: string): void {
  const v = (country ?? "").trim().toUpperCase();
  if (!v) return;
  store.applyState({ country_iso: v, location_type: side, page: 1 });
  flagHints.value.country_iso = v;
  void store.fetchPage();
}

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
  // Cliente (id_cliente). Es el filtro que aplica el clic en el nombre de
  // cliente de una fila; sin chip el listado quedaría acotado sin forma de
  // volver atrás. Se muestra el nombre, no el id.
  if (state.value.id_cliente) {
    out.push({
      field: "id_cliente",
      group: t("filters.group.client"),
      value:
        clientNameHints.value[String(state.value.id_cliente)] ||
        String(state.value.id_cliente),
    });
  }
  // Country (country_iso + location_type). One chip, labelled by side
  // (origin/destination), with the flag rendered from the ISO.
  if (state.value.country_iso && state.value.location_type) {
    out.push({
      field: "country_iso",
      group:
        state.value.location_type === "P"
          ? t("filters.group.origin_country")
          : t("filters.group.dest_country"),
      value: state.value.country_iso,
      iso: state.value.country_iso,
    });
  }
  // Date range (topbar popover OR clicking a row's Created time). A single
  // chip covers both bounds so removing it clears the whole range.
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
  for (const def of SHIPMENT_ADVANCED_CHIPS) {
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

const SHIPMENT_ADVANCED_CHIPS: Array<{
  field: keyof typeof state.value;
  label: string;
  yesNo?: boolean;
}> = [
  { field: "id", label: "filters.shipment.fields.shipment_id" },
  { field: "AWB_forn", label: "filters.shipment.fields.awb" },
  { field: "RIF_cliente", label: "filters.fields.client_ref" },
  { field: "id_fornitore", label: "filters.shipment.fields.courier" },
  { field: "note", label: "filters.fields.notes" },
  { field: "city", label: "filters.shipment.fields.dest_city" },
  { field: "controllata", label: "filters.fields.controlled" },
  { field: "consegna_firma", label: "filters.fields.delivered" },
  { field: "presa_stato", label: "filters.shipment.fields.pickup_status" },
  { field: "archiviata", label: "filters.fields.archived" },
  { field: "stato_giac", label: "filters.shipment.fields.storage_state" },
  { field: "has_contrassegno", label: "filters.shipment.fields.has_cod", yesNo: true },
  { field: "has_assicurazione", label: "filters.fields.has_insurance", yesNo: true },
  { field: "peso_da", label: "filters.fields.weight_from" },
  { field: "peso_a", label: "filters.fields.weight_to" },
  { field: "peso_tassax", label: "filters.shipment.fields.chargeable_weight" },
  { field: "id_servizio", label: "filters.shipment.fields.service_id" },
];

function removeFilter(field: string): void {
  if (field === "type") {
    store.applyState({ type: "all", kpi: "", page: 1 });
  } else if (field === "date_range") {
    store.applyState({ date_from: "", date_to: "", page: 1 });
  } else if (field === "country_iso") {
    store.applyState({ country_iso: "", location_type: "", page: 1 });
    delete flagHints.value.country_iso;
  } else {
    store.applyState({ [field]: "", page: 1 });
    delete flagHints.value[field];
  }
  void store.fetchPage();
}

function clearAllFilters(): void {
  store.applyState(shipmentResetFilters(state.value));
  flagHints.value = {};
  clientNameHints.value = {};
  void store.fetchPage();
}

const filterPanelOpen = ref(false);
const toasts = useToastStore();

const selected = ref<ShipmentListRow[]>([]);
const bulkBusy = ref(false);
const selectedIds = computed<number[]>(() => selected.value.map((r) => r.id));

/**
 * Params handed to the export endpoint — the very same ones the listing sends,
 * minus pagination.
 *
 * The backend runs them through the same Shipments_List_Request_Handler the
 * listing uses, so the file covers exactly what is on screen: all ~60 filters
 * and the KPI presets, not a subset. Pagination is dropped on purpose — an
 * export covers the whole result set, not the page being viewed.
 */
const exportParams = computed<Record<string, unknown>>(() => {
  const {
    page: _page,
    per_page: _perPage,
    ...rest
  } = buildShipmentListQuery(state.value);
  return rest as Record<string, unknown>;
});

// Per-row "launch tracking": id of the row currently tracking (for its spinner).
const trackingId = ref<number | null>(null);
async function onLaunchTracking(id: number): Promise<void> {
  trackingId.value = id;
  try {
    const r = await shipmentService.launchTracking(id);
    if (r.success && (r.processed ?? 0) > 0) {
      toasts.push("success", t("listing.toast.tracking_ok"));
      void store.fetchPage();
    } else {
      toasts.push("error", r.error || t("listing.toast.tracking_failed"));
    }
  } catch (err) {
    toasts.push("error", (err as Error).message);
  } finally {
    trackingId.value = null;
  }
}

async function onBulkArchive(): Promise<void> {
  if (!selectedIds.value.length) return;
  bulkBusy.value = true;
  try {
    const r = await shipmentService.bulkArchive(selectedIds.value);
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
    const r = await shipmentService.bulkControl(selectedIds.value);
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

async function onBulkTracking(): Promise<void> {
  if (!selectedIds.value.length) return;
  const count = selectedIds.value.length;
  bulkBusy.value = true;
  try {
    // Enqueues a background job: the tracking runs off-request and persists.
    // We confirm it was queued; the list will reflect new states on its next
    // refresh (the job is not instantaneous).
    const r = await shipmentService.bulkTracking(selectedIds.value);
    if (r.success && r.queued) {
      toasts.push("success", t("listing.toast.tracking_queued", count));
      selected.value = [];
    } else {
      toasts.push("error", r.error || t("listing.toast.tracking_failed"));
    }
  } catch (err) {
    toasts.push("error", (err as Error).message);
  } finally {
    bulkBusy.value = false;
  }
}

const advancedFilterCount = computed<number>(() => {
  return shipmentActiveFilterCount(state.value);
});

let urlSyncSuppressed = false;

function syncStateToUrl(): void {
  if (urlSyncSuppressed) return;
  const next: Record<string, string> = serializeShipmentListQuery(state.value);
  // `view` (registro abierto en el drawer) NO es un filtro, asi que
  // `serializeShipmentListQuery` no lo incluye y hay que re-adjuntarlo aqui, o
  // cualquier re-sincronizacion del listado lo borraria de la URL.
  // Se lee de `openViewId` y no de `route.query.view` porque vue-router
  // actualiza `route` de forma asincrona: este watcher puede correr con la
  // ruta anterior, cuando `view` todavia no esta en la query.
  if (openViewId.value != null) next.view = String(openViewId.value);
  next.work_view = activeWorkView.value.id;
  const cur = route.query;
  const sameKeys =
    Object.keys(next).length === Object.keys(cur).length &&
    Object.entries(next).every(([k, v]) => String(cur[k] ?? "") === v);
  if (sameKeys) return;
  router.replace({ query: next });
}

function syncUrlToState(): void {
  const parsed = parseShipmentListQuery(route.query as Record<string, unknown>);
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

function openShipment(id: string | number): void {
  lastOpenAt = performance.now();
  openViewId.value = Number(id);
  void router.replace({ query: { ...route.query, view: String(id) } });
}

/** Lee `?view=` de la URL y devuelve el id, o null si no es valido. */
function parseViewId(q: typeof route.query): number | null {
  const raw = Array.isArray(q.view) ? q.view[0] : q.view;
  const id = Number(raw);
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
 * (era exactamente el bug: la URL revertia a `/shipment/list` sin `view`).
 * El cierre es siempre explicito, via `setDrawerOpen(false)`.
 */
watch(
  () => route.query.view,
  (raw) => {
    const fromUrl = parseViewId({ view: raw } as typeof route.query);
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
    if (parseViewId({ view: raw } as typeof route.query) === open) return;
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

/** URL absoluta del detalle Vue moderno (para "abrir en nueva pestaña"),
 *  preservando el filtro actual del listado en la query para que el
 *  RecordNavigator reconstruya el mismo cohorte también en la pestaña nueva. */
function detailHref(id: string | number): string {
  const qs = new URLSearchParams(
    Object.entries(route.query).flatMap(([k, v]) =>
      v == null
        ? []
        : Array.isArray(v)
          ? v.map((x) => [k, String(x)])
          : [[k, String(v)]],
    ),
  ).toString();
  // "Abrir en nueva pestaña": dentro de operations el detalle es una ruta hash
  // (#/shipment/:id). La URL vieja /shipment/:id ahora redirige al listado, así
  // que apuntamos directamente a la ruta de operations con el filtro en la query.
  // Delegar en detailHref en vez de rearmar la URL aquí: el prefijo de la SPA
  // (hoy /ops, antes /operations#) vive en navTargets, y tenerlo duplicado en
  // cada listado es lo que dejó estos enlaces apuntando al esquema viejo.
  return spaDetailHref("shipment", id, qs);
}

/** URL absoluta del detalle en el form legacy (winbody pp=spedy). El usuario
 *  puede preferir la vista clásica para ciertas operaciones no migradas. */
function legacyDetailHref(id: string | number): string {
  return `/erp/winbody.php?pp=spedy&id=${encodeURIComponent(String(id))}`;
}

/** Abre el listado de postfacturación (réplica de la vista legacy faddebit2). */
function openRecharge(): void {
  router.push({ name: "recharge-list" });
}

/**
 * Compact representation of the active filter set — used as the cache
 * key for the list context so two tabs filtered differently don't
 * restore over each other.
 */
function serializeFilterKey(): string {
  const q = serializeShipmentListQuery(state.value);
  return Object.keys(q)
    .sort()
    .map((k) => `${k}=${q[k]}`)
    .join("&");
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
  item: ShipmentListRow,
): Array<{ label: string; color: string }> {
  const out: Array<{ label: string; color: string }> = [];
  // item.status.label comes from the backend — rendered as-is (not i18n'd).
  if (item.status.label) {
    out.push({
      label: item.status.label,
      color: item.status.color || "default",
    });
  } else {
    const delivered =
      item.dates.delivered && item.dates.delivered !== "0000-00-00 00:00:00";
    if (delivered) {
      out.push({
        label: t("enums.shipment_status.delivered"),
        color: "success",
      });
    } else if (item.awb) {
      out.push({ label: t("enums.shipment_status.in_transit"), color: "info" });
    } else {
      out.push({ label: t("enums.shipment_status.draft"), color: "default" });
    }
  }
  if (item.cod.amount > 0) {
    out.push({
      label: t("enums.cod_amount", { amount: item.cod.amount.toFixed(2) }),
      color: item.cod.collected === "CLC" ? "success" : "warning",
    });
  }
  return out;
}

watch(() => state.value, syncStateToUrl, { deep: true });

/**
 * Sincroniza URL -> estado del listado, IGNORANDO `view`.
 *
 * `view` es el registro abierto en el drawer, no un filtro: no forma parte de
 * `ShipmentListUrlState` ni de `serializeShipmentListQuery`. Observando
 * `route.query` entero, abrir el drawer (que solo anade `?view=`) disparaba
 * `syncUrlToState` -> `applyState` -> reemplazo de `state.value` -> el watch
 * `deep` de arriba -> `syncStateToUrl`, que reescribia la query. Ese
 * ida y vuelta cerraba el drawer recien abierto.
 *
 * Se observa por tanto la query SIN `view`, serializada: solo los cambios de
 * filtro real re-sincronizan el estado.
 */
watch(() => {
  const { view: _view, ...filters } = route.query;
  return JSON.stringify(filters);
}, syncUrlToState);

/**
 * Los KPI cuentan sobre el MISMO filtro que el listado, así que se recalculan
 * cuando cambia el filtro — pero no al paginar, reordenar o cambiar de tile
 * (`type`), que no alteran el conjunto contado y solo añadirían tráfico.
 */
watch(
  () => {
    const { page, per_page, sort, sort_dir, type, ...filters } =
      buildShipmentListQuery(state.value);
    return JSON.stringify(filters);
  },
  () => {
    void refreshKpiCounts();
  },
);

async function enterList(): Promise<void> {
  syncUrlToState();
  await store.fetchPage();
  // Después del listado, nunca antes: los KPI son secundarios y no deben
  // competir por conexiones con la página que el operador espera ver.
  void refreshKpiCounts();

  // If we returned via "Torna alla lista" the URL carries `restore=1`.
  // Pop the stash and try to scroll the previously-clicked row into
  // view; if the row is no longer rendered (paged off, filter
  // mutated) we fall back to the saved scrollY inside restoreListScroll.
  if (route.query.restore === "1") {
    const ctx = loadListContext("shipment-list");
    if (ctx && ctx.filterKey === serializeFilterKey()) {
      restoreListScroll(ctx);
    }
    clearListContext("shipment-list");
    // Drop `restore=1` from the URL so a refresh doesn't replay it.
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

/* Destination cell — flag leads the address block so the operator can
   scan lanes by country at a glance. */
.dest-cell {
  display: flex;
  align-items: center;
  gap: 9px;
}
.dest-flag-btn {
  flex: 0 0 auto;
  padding: 2px;
  border: 0;
  background: none;
  cursor: pointer;
  line-height: 0;
  border-radius: 5px;
  transition:
    background 0.12s,
    box-shadow 0.12s;
}
.dest-flag-btn:hover:not(:disabled) {
  background: rgba(var(--v-theme-primary), 0.1);
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.1);
}
.dest-flag-btn:disabled {
  cursor: default;
}
.dest-flag-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-primary));
}
.dest-text {
  min-width: 0;
}

/* ── Filterable values ── any row value that applies a column filter on
   click. Bare <button> for accessibility, styled to read as inline text
   until hovered. (Mirrors CargoListPage.) */
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
