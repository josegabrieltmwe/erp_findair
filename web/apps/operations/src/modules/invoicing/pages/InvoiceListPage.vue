<template>
  <DashboardShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
    <!-- Marca / título (igual patrón que cargo/list) -->
    <template #topbar-title>
      <div class="d-flex align-center ga-2">
        <v-icon icon="mdi-receipt-text" size="24" color="primary" />
        <span class="text-h6">{{ t("invoicing.invoice.list") }}</span>
      </div>
    </template>

    <!-- Acciones de la barra superior -->
    <template #topbar-actions>
      <!-- Toggle paginado/scroll infinito, siempre visible (igual que
           cargo/shipment, que lo sitúan en la barra superior). -->
      <ViewModeToggle v-model="viewMode" />
      <v-btn
        variant="text"
        icon="mdi-refresh"
        :loading="store.loading"
        @click="store.fetch()"
      />
      <v-btn
        v-if="caps.canWrite"
        variant="tonal"
        prepend-icon="mdi-calendar-month-outline"
        :to="{ name: 'invoicing-monthly' }"
      >
        {{ t("invoicing.monthly.title") }}
      </v-btn>
      <v-menu v-if="caps.canExport">
        <template #activator="{ props: menuProps }">
          <v-btn
            variant="tonal"
            prepend-icon="mdi-download"
            append-icon="mdi-menu-down"
            v-bind="menuProps"
          >
            {{ t("invoicing.exports.menu") }}
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            prepend-icon="mdi-earth"
            :title="t('invoicing.exports.intra')"
            @click="openExport('intra')"
          />
          <v-list-item
            prepend-icon="mdi-file-excel-outline"
            :title="t('invoicing.exports.balance')"
            @click="openExport('balance')"
          />
        </v-list>
      </v-menu>
      <v-menu v-if="caps.canWrite">
        <template #activator="{ props: menuProps }">
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            append-icon="mdi-menu-down"
            v-bind="menuProps"
          >
            {{ t("invoicing.invoice.new") }}
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            prepend-icon="mdi-receipt-text-plus"
            :title="t('invoicing.invoice.new_batch')"
            @click="generateOpen = true"
          />
          <v-list-item
            prepend-icon="mdi-checkbox-multiple-marked-outline"
            :title="t('invoicing.invoice.select.title')"
            @click="selectOpen = true"
          />
          <v-list-item
            prepend-icon="mdi-file-document-edit"
            :title="t('invoicing.invoice.manual.title')"
            @click="manualOpen = true"
          />
          <v-list-item
            prepend-icon="mdi-receipt-text-arrow-left"
            :title="t('invoicing.invoice.supplier.title')"
            @click="supplierOpen = true"
          />
          <v-list-item
            prepend-icon="mdi-calendar-month-outline"
            :title="t('invoicing.monthly.title')"
            @click="router.push({ name: 'invoicing-monthly' })"
          />
          <v-list-item
            prepend-icon="mdi-truck-check-outline"
            :title="t('invoicing.carrier.title')"
            @click="router.push({ name: 'invoicing-carrier-reconciliation' })"
          />
        </v-list>
      </v-menu>
    </template>

    <!-- Sidebar: botón "Advanced filters" que abre el drawer lateral. Mismo
         patrón que cargo/shipment; en rail colapsado muestra solo el icono. -->
    <template #sidebar="{ collapsed }">
      <!-- Menú universal (sustituye a PlatformSidebar vía `hide-platform-nav`). -->
      <OperationsNav :collapsed="collapsed" />

      <button
        type="button"
        class="sidebar-action"
        :class="{ 'sidebar-action--rail': collapsed }"
        :title="
          activeFilterCount > 0
            ? t('invoicing.listing.advanced_active', {
                count: activeFilterCount,
              })
            : t('invoicing.listing.advanced_open')
        "
        @click="filterPanelOpen = true"
      >
        <v-icon icon="mdi-tune-variant" size="16" />
        <span v-if="!collapsed" class="sidebar-action-label">{{
          t("invoicing.listing.advanced_filters")
        }}</span>
        <span v-if="activeFilterCount > 0" class="filters-card-badge">{{
          activeFilterCount
        }}</span>
      </button>

      <!-- Configuración de las series de numeración del partner. Navegación
           intra-SPA (router.push), no href: PlatformSidebar es compartido por
           todas las SPAs y ahí no debe aparecer. -->
      <button
        v-if="canAdminNumbering"
        type="button"
        class="sidebar-action"
        :class="{ 'sidebar-action--rail': collapsed }"
        :title="t('invoicing.numbering.title')"
        @click="goToNumbering"
      >
        <v-icon icon="mdi-counter" size="16" />
        <span v-if="!collapsed" class="sidebar-action-label">{{
          t("invoicing.numbering.title")
        }}</span>
      </button>

      <!-- Envíos al Estado (R7-R8): página propia del módulo fiscal. -->
      <button
        type="button"
        class="sidebar-action"
        :class="{ 'sidebar-action--rail': collapsed }"
        :title="t('invoicing.envios.title')"
        @click="goToEnvios"
      >
        <v-icon icon="mdi-bank-transfer-out" size="16" />
        <span v-if="!collapsed" class="sidebar-action-label">{{
          t("invoicing.envios.title")
        }}</span>
      </button>

      <!-- Configuración fiscal con vigencias (DISENO §3.2). -->
      <button
        type="button"
        class="sidebar-action"
        :class="{ 'sidebar-action--rail': collapsed }"
        :title="t('invoicing.fiscal.title')"
        @click="goToFiscal"
      >
        <v-icon icon="mdi-scale-balance" size="16" />
        <span v-if="!collapsed" class="sidebar-action-label">{{
          t("invoicing.fiscal.title")
        }}</span>
      </button>
    </template>

    <!-- Emitidas / Recibidas -->
    <div class="invoice-tabs-row">
      <v-tabs
        :model-value="store.tab"
        density="compact"
        color="primary"
        @update:model-value="onTab"
      >
        <v-tab value="A">{{ t("invoicing.tabs.issued") }}</v-tab>
        <v-tab value="P">{{ t("invoicing.tabs.received") }}</v-tab>
      </v-tabs>
      <template v-if="isSupplier">
        <v-text-field
          v-model="supplierSearch"
          :label="t('invoicing.supplier_list.search')"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="invoice-tabs-field"
          @keyup.enter="applySupplierSearch"
          @click:clear="applySupplierSearch"
        />
        <v-select
          :model-value="store.filters.controllo_stato || null"
          :items="controlOptions"
          :label="t('invoicing.supplier_list.control')"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="invoice-tabs-field"
          @update:model-value="(v) => setFilter('controllo_stato', v || '')"
        />
      </template>
    </div>

    <!-- Filtros activos como chips removibles (click-to-filter). -->
    <ActiveFilterChips
      :filters="activeFilters"
      @remove="removeFilter"
      @clear="clearAllFilters"
    />

    <!-- Contenido: tabla compartida ListingDataView (paginado + scroll
         infinito) — mismo componente que cargo/shipment. Ver la factura es
         exclusivo del botón de acción; clicar un valor filtra por él. -->
    <div class="invoice-list-card">
      <ListingDataView
        :source="dataSource"
        :headers="headers"
        :selected="selected"
        :mode="viewMode"
        :sort-key-map="SORT_KEY_MAP"
        :selectable="false"
        @update:mode="(v) => (viewMode = v)"
      >
        <template #cell.numero="{ item }">
          <button
            type="button"
            class="filterable"
            :title="t('invoicing.invoice.filter_click.by_numero')"
            @click.stop="setFilter('numero', (item as InvoiceListItem).numero)"
          >
            {{ (item as InvoiceListItem).numero }}
          </button>
        </template>
        <template #cell.numero_alfanum="{ item }">
          <button
            type="button"
            class="filterable"
            :title="t('invoicing.invoice.filter_click.by_numero')"
            @click.stop="
              setFilter('numero', (item as InvoiceListItem).numero_alfanum)
            "
          >
            {{
              (item as InvoiceListItem).numero_alfanum ||
              (item as InvoiceListItem).numero
            }}
          </button>
        </template>
        <template #cell.controllo_stato="{ item }">
          <v-menu v-if="caps.canWrite">
            <template #activator="{ props: mp }">
              <v-chip
                v-bind="mp"
                size="small"
                :color="
                  CONTROL_COLOR[
                    controlStateOf((item as InvoiceListItem).controllo_stato)
                  ]
                "
                variant="tonal"
                style="cursor: pointer"
                :disabled="controlBusy === Number((item as InvoiceListItem).id)"
              >
                {{
                  t(
                    `invoicing.supplier_list.control_${controlStateOf((item as InvoiceListItem).controllo_stato)}`,
                  )
                }}
              </v-chip>
            </template>
            <v-list density="compact">
              <v-list-item
                v-for="c in CONTROL_STATES"
                :key="c"
                :title="t(`invoicing.supplier_list.control_${c}`)"
                @click="changeControl(item as InvoiceListItem, c)"
              />
            </v-list>
          </v-menu>
          <v-chip
            v-else
            size="small"
            :color="
              CONTROL_COLOR[
                controlStateOf((item as InvoiceListItem).controllo_stato)
              ]
            "
            variant="tonal"
          >
            {{
              t(
                `invoicing.supplier_list.control_${controlStateOf((item as InvoiceListItem).controllo_stato)}`,
              )
            }}
          </v-chip>
        </template>
        <template #cell.pagos="{ item }">
          <div
            v-if="visiblePaymentStatus((item as InvoiceListItem).pagos)"
            class="d-flex flex-column"
          >
            <v-chip
              size="small"
              variant="tonal"
              style="width: fit-content"
              :color="
                PAYMENT_COLOR[
                  visiblePaymentStatus((item as InvoiceListItem).pagos)!
                ]
              "
            >
              {{
                t(
                  `invoicing.payment.${visiblePaymentStatus((item as InvoiceListItem).pagos)}`,
                )
              }}
            </v-chip>
            <span
              v-if="showPendingDetail((item as InvoiceListItem).pagos)"
              class="text-caption text-medium-emphasis"
            >
              {{
                money(
                  (item as InvoiceListItem).pagos?.pending_amount ?? 0,
                  (item as InvoiceListItem).valuta_sigla,
                )
              }}
              <template v-if="(item as InvoiceListItem).pagos?.next_due">
                · {{ t("invoicing.payment.due") }}
                {{ (item as InvoiceListItem).pagos?.next_due }}
              </template>
            </span>
          </div>
        </template>
        <template #cell.data_fattura="{ item }">
          {{ (item as InvoiceListItem).data_fattura }}
        </template>
        <template #cell.rag_soc="{ item }">
          <button
            type="button"
            class="filterable text-truncate invoice-client-btn"
            :title="t('invoicing.invoice.filter_click.by_client')"
            @click.stop="filterByClient(item as InvoiceListItem)"
          >
            {{
              (item as InvoiceListItem).rag_soc ||
              `#${(item as InvoiceListItem).id_anagrafica ?? "—"}`
            }}
          </button>
        </template>
        <template #cell.stato_sdi="{ item }">
          <button
            type="button"
            class="filterable"
            :title="t('invoicing.invoice.filter_click.by_sdi')"
            @click.stop="
              setFilter('stato_sdi', (item as InvoiceListItem).stato_sdi)
            "
          >
            <StatusChip
              :status="(item as InvoiceListItem).stato_sdi"
              :map="sdiStatusMap"
              style="cursor: pointer"
            />
          </button>
        </template>
        <template #cell.importo_netto="{ item }">
          {{
            money(
              (item as InvoiceListItem).importo_netto,
              (item as InvoiceListItem).valuta_sigla,
            )
          }}
        </template>
        <template #cell.importo_iva="{ item }">
          {{
            money(
              (item as InvoiceListItem).importo_iva,
              (item as InvoiceListItem).valuta_sigla,
            )
          }}
        </template>
        <template #cell.actions="{ item }">
          <v-btn
            :icon="true"
            size="small"
            variant="text"
            color="primary"
            :title="t('common.view')"
            @click.stop="openRow(Number((item as InvoiceListItem).id))"
          >
            <v-icon icon="mdi-eye-outline" />
          </v-btn>
        </template>
      </ListingDataView>
    </div>

    <!-- Modal de generación (en vez de página /new). prefill-* viene de los query
         params client/shipment (botón "Genera fattura" del detalle cargo/courier). -->
    <GenerateInvoiceDialog
      v-model="generateOpen"
      :prefill-client="prefillClient"
      :prefill-shipment="prefillShipment"
      :prefill-shipment-tipo="prefillShipmentTipo"
      @created="onGenerated"
    />
    <!-- Drawer de filtros avanzados (patrón estándar listados). -->
    <InvoiceFilterPanel
      v-model="filterPanelOpen"
      :filters="{
        data_da: f.data_da,
        data_a: f.data_a,
        numero: f.numero,
        stato_sdi: f.stato_sdi,
        stato_pagamento: f.stato_pagamento,
      }"
      :loading="store.loading"
      @apply="onApplyFilters"
    />
    <BillableShipmentsDialog v-model="selectOpen" @created="onGenerated" />
    <ManualInvoiceDialog v-model="manualOpen" @created="onGenerated" />
    <ExportDialog v-model="exportOpen" :kind="exportKind" />
    <SupplierInvoiceDialog v-model="supplierOpen" @created="onGenerated" />
  </DashboardShell>
</template>

<script setup lang="ts">
import { reactive, computed, ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
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
import StatusChip, { type StatusEntry } from "@shared/ui/StatusChip.vue";
import GenerateInvoiceDialog from "../components/invoice/GenerateInvoiceDialog.vue";
import BillableShipmentsDialog from "../components/invoice/BillableShipmentsDialog.vue";
import InvoiceFilterPanel, {
  type InvoiceFilters,
} from "../components/invoice/InvoiceFilterPanel.vue";
import ExportDialog from "../components/invoice/ExportDialog.vue";
import ManualInvoiceDialog from "../components/invoice/ManualInvoiceDialog.vue";
import SupplierInvoiceDialog from "../components/invoice/SupplierInvoiceDialog.vue";
import { useToastStore } from "../stores/toast.store";
import { useInvoiceListStore } from "../stores/invoice_list.store";
import { capabilities, can } from "../services/http";
import type { InvoiceListItem } from "../services/invoice.service";
import {
  CONTROL_COLOR,
  CONTROL_STATES,
  controlStateOf,
  supplierInvoiceApi,
  type ControlState,
} from "../services/supplierInvoice.service";
import {
  PAYMENT_COLOR,
  sanitizePaymentFilter,
  showPendingDetail,
  visiblePaymentStatus,
} from "../services/paymentStatus";

/** Fila con `id` numérico que exige el contrato genérico ListSource. */
type IdRow = { id: number };

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const store = useInvoiceListStore();
const toasts = useToastStore();
const caps = capabilities();

/** Configuración de series de numeración: propia de cada partner. */
const canAdminNumbering = computed(() => can.adminNumbering());

function goToNumbering(): void {
  void router.push({ name: "numbering-settings" });
}

function goToEnvios(): void {
  void router.push({ name: "invoicing-envios" });
}

function goToFiscal(): void {
  void router.push({ name: "invoicing-fiscal-config" });
}

const isSupplier = computed(() => store.tab === "P");
const supplierSearch = ref("");
const controlBusy = ref<number | null>(null);
const controlOptions = computed(() =>
  CONTROL_STATES.map((c) => ({
    title: t(`invoicing.supplier_list.control_${c}`),
    value: c,
  })),
);

function onTab(v: unknown): void {
  const next = v === "P" ? "P" : "A";
  f.data_da = f.data_a = f.numero = f.stato_sdi = f.stato_pagamento = "";
  supplierSearch.value = "";
  store.setTab(next);
}
function applySupplierSearch(): void {
  store.setFilters({ search: supplierSearch.value?.trim() || undefined });
}
async function changeControl(
  item: InvoiceListItem,
  state: ControlState,
): Promise<void> {
  const id = Number(item.id);
  controlBusy.value = id;
  try {
    await supplierInvoiceApi.setControlState(id, state);
    const row = store.rows.find((r) => Number(r.id) === id);
    if (row) row.controllo_stato = state;
  } catch {
    toasts.push("error", t("invoicing.supplier_list.control_failed"));
  } finally {
    controlBusy.value = null;
  }
}

const generateOpen = ref(false);
const selectOpen = ref(false);
const manualOpen = ref(false);
const exportOpen = ref(false);
const exportKind = ref<"intra" | "balance">("intra");
function openExport(kind: "intra" | "balance"): void {
  exportKind.value = kind;
  exportOpen.value = true;
}
const supplierOpen = ref(false);
const filterPanelOpen = ref(false);
// Nº de filtros activos (badge del botón "Advanced filters").
const activeFilterCount = computed(
  () =>
    [f.data_da, f.data_a, f.numero, f.stato_sdi, f.stato_pagamento].filter(
      (v) => v !== "" && v != null,
    ).length,
);
// Contexto del botón "Genera fattura" del detalle cargo/courier (query params):
// cliente preseleccionado + expedición concreta a facturar (paridad fattsw3).
const prefillClient = computed<number | null>(() => {
  const v = Number(route.query.client ?? 0);
  return v > 0 ? v : null;
});
const prefillShipment = computed<number | null>(() => {
  const v = Number(route.query.shipment ?? 0);
  return v > 0 ? v : null;
});
const prefillShipmentTipo = computed<"express" | "cargo" | null>(() => {
  const v = String(route.query.tipo ?? "");
  return v === "express" || v === "cargo" ? v : null;
});
function onGenerated(): void {
  void store.fetch(); // refrescar el listado tras generar
}

const f = reactive({
  data_da: "",
  data_a: "",
  numero: "",
  stato_sdi: "",
  stato_pagamento: "",
  per_page: 25,
});

// Modo de vista (paginado/scroll infinito) persistido, igual que cargo/shipment.
const viewMode = useListViewMode("tmwe:list-view-mode:invoicing", "paginated");
// Invoicing no tiene selección bulk; el contrato exige el array igualmente.
const selected = ref<IdRow[]>([]);

/**
 * Adaptador del store al contrato genérico ListSource que espera
 * ListingDataView. Las filas se exponen con `id` numérico (el backend puede
 * devolver string en valores especiales como las facturas resumen).
 */
const dataSource = computed<ListSource<IdRow>>(() => ({
  total: store.total,
  rows: store.rows.map((r) => ({
    ...r,
    id: Number(r.id),
  })) as unknown as IdRow[],
  loading: store.loading,
  error: store.error,
  page: store.page,
  perPage: store.perPage,
  sort: store.sort,
  sortDir: store.sortDir,
  loadPage: store.loadPage,
  loadMore: store.loadMore,
  refresh: store.refresh,
  setSort: store.setSort,
  setPerPage: store.setPerPage,
}));

const headers = computed<DataTableHeader[]>(() => {
  const sup = isSupplier.value;
  return [
    sup
      ? {
          title: t("invoicing.supplier_list.external_number"),
          key: "numero_alfanum",
          width: 150,
          sortable: false,
        }
      : { title: t("invoicing.invoice.number"), key: "numero", width: 120 },
    {
      title: t("invoicing.invoice.date"),
      key: "data_fattura",
      width: 130,
      sortable: !sup,
    },
    {
      title: sup
        ? t("invoicing.supplier_list.supplier")
        : t("invoicing.invoice.client"),
      key: "rag_soc",
      sortable: !sup,
    },
    {
      title: t("invoicing.invoice.net"),
      key: "importo_netto",
      align: "end",
      width: 130,
      sortable: !sup,
    },
    {
      title: t("invoicing.invoice.vat"),
      key: "importo_iva",
      align: "end",
      width: 120,
      sortable: !sup,
    },
    ...(sup
      ? [
          {
            title: t("invoicing.supplier_list.control"),
            key: "controllo_stato",
            width: 170,
            sortable: false,
          } as DataTableHeader,
        ]
      : [
          {
            title: t("invoicing.invoice.status_sdi"),
            key: "stato_sdi",
            width: 160,
          } as DataTableHeader,
        ]),
    {
      title: t("invoicing.payment.title"),
      key: "pagos",
      width: 190,
      sortable: false,
    },
    { title: "", key: "actions", align: "end", sortable: false, width: 70 },
  ];
});

/**
 * UI key → clave de orden enviada al backend. El controller (Invoice_Service::
 * build_list_order) mapea estas claves a columnas SQL reales con whitelist, así
 * que aquí la correspondencia es identidad. `rag_soc` ordena por la razón
 * social del cliente (JOIN anagrafiche).
 */
const SORT_KEY_MAP: Record<string, string> = {
  numero: "numero",
  data_fattura: "data_fattura",
  rag_soc: "rag_soc",
  importo_netto: "importo_netto",
  importo_iva: "importo_iva",
  stato_sdi: "stato_sdi",
};

// Mapa estado SDI → { label (i18n), color } para el StatusChip compartido.
// computed para que las etiquetas reaccionen al cambio de idioma.
const SDI_COLORS: Record<string, string> = {
  N: "grey",
  I: "info",
  O: "success",
  K: "error",
  W: "warning",
};
const sdiStatusMap = computed<Record<string, StatusEntry>>(() =>
  Object.fromEntries(
    Object.entries(SDI_COLORS).map(([k, color]) => [
      k,
      { label: t(`invoicing.sdi.${k}`), color },
    ]),
  ),
);
function money(v: number | string, cur: string): string {
  return `${Number(v ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur || "EUR"}`;
}

// Aplica los filtros que llegan del drawer (InvoiceFilterPanel).
function onApplyFilters(next: InvoiceFilters): void {
  f.data_da = next.data_da;
  f.data_a = next.data_a;
  f.numero = next.numero;
  f.stato_sdi = next.stato_sdi;
  f.stato_pagamento = sanitizePaymentFilter(next.stato_pagamento) ?? "";
  store.setFilters({
    stato_pagamento: f.stato_pagamento || undefined,
    data_da: f.data_da || undefined,
    data_a: f.data_a || undefined,
    numero: f.numero || undefined,
    stato_sdi: f.stato_sdi || undefined,
    per_page: f.per_page,
  });
}

function openRow(id: number): void {
  router.push({ name: "invoicing-detail", params: { id: String(id) } });
}

// ── Click-to-filter ────────────────────────────────────────────────────────
// Al clicar un valor en una celda se aplica como filtro de esa columna vía el
// store (setFilters resetea a página 1 y recarga por AJAX). Los campos mapean a
// filtros que el backend Invoice_Crud_Controller ya soporta (id_anagrafica,
// stato_sdi, numero). Ver/abrir la factura es exclusivo del botón de acción.
type ClickFilterField =
  | "id_anagrafica"
  | "stato_sdi"
  | "numero"
  | "controllo_stato"
  | "stato_pagamento";

function setFilter(
  field: ClickFilterField,
  value: string | number | undefined,
): void {
  const v = String(value ?? "").trim();
  if (!v) return;
  // Reflejar en el estado local de filtros del drawer cuando aplique, para que
  // el badge de "filtros activos" y el panel queden coherentes.
  if (field === "stato_sdi") f.stato_sdi = v;
  if (field === "numero") f.numero = v;
  if (field === "stato_pagamento") f.stato_pagamento = v;
  store.setFilters({ [field]: v });
}

// Etiqueta legible del valor para el chip.
function filterValueLabel(field: ClickFilterField, value: string): string {
  if (field === "stato_sdi") return `${t(`invoicing.sdi.${value}`)} (${value})`;
  if (field === "controllo_stato")
    return t(`invoicing.supplier_list.control_${value}`);
  if (field === "stato_pagamento") return t(`invoicing.payment.${value}`);
  return value;
}
const FILTER_GROUP_KEY: Record<ClickFilterField, string> = {
  id_anagrafica: "invoice.client",
  stato_sdi: "invoice.status_sdi",
  numero: "invoice.number",
  controllo_stato: "invoicing.supplier_list.control",
  stato_pagamento: "invoicing.payment.title",
};

// Chips de filtros activos. Se leen del store.filters (fuente única). Para el
// cliente mostramos el nombre si lo tenemos cacheado de una fila; si no, el id.
const clientNameById = ref<Record<string, string>>({});
const activeFilters = computed<ActiveFilter[]>(() => {
  const out: ActiveFilter[] = [];
  const flt = store.filters as Record<string, unknown>;
  for (const field of Object.keys(FILTER_GROUP_KEY) as ClickFilterField[]) {
    const value = flt[field];
    if (typeof value === "string" && value !== "") {
      let label = filterValueLabel(field, value);
      if (field === "id_anagrafica")
        label = clientNameById.value[value] ?? `#${value}`;
      out.push({
        field,
        group: t(FILTER_GROUP_KEY[field]) as string,
        value: label,
      });
    }
  }
  return out;
});

function removeFilter(field: string): void {
  if (field === "stato_sdi") f.stato_sdi = "";
  if (field === "numero") f.numero = "";
  if (field === "stato_pagamento") f.stato_pagamento = "";
  store.setFilters({ [field]: "" });
}
function clearAllFilters(): void {
  f.stato_sdi = "";
  f.numero = "";
  f.stato_pagamento = "";
  supplierSearch.value = "";
  store.setFilters({
    stato_pagamento: "",
    controllo_stato: "",
    search: "",
    id_anagrafica: "",
    stato_sdi: "",
    numero: "",
    data_da: "",
    data_a: "",
  });
}

// Cachea nombre de cliente al clicar, para etiquetar bien el chip.
function filterByClient(item: InvoiceListItem): void {
  const id = String(item.id_anagrafica ?? "");
  if (!id) return;
  if (item.rag_soc) clientNameById.value[id] = item.rag_soc;
  setFilter("id_anagrafica", id);
}

onMounted(() => {
  // ?tipo=P filtra el listado a facturas de proveedor (entrada directa desde
  // un menú externo). setFilters ya recarga, así que no se llama a fetch().
  const tipo = route.query.tipo;
  if (tipo === "P") {
    store.setTab("P");
  } else if (tipo === "A") {
    store.setFilters({ tipo_fattura: tipo });
  } else {
    void store.fetch();
  }

  // Abrir el modal de generación si se llegó con ?new=1 (o desde /new).
  if (route.query.new === "1" && caps.canWrite) {
    generateOpen.value = true;
  }
  // ?supplier=1 abre directamente el alta de factura de proveedor.
  if (route.query.supplier === "1" && caps.canWrite) {
    supplierOpen.value = true;
  }
});
</script>

<style scoped lang="scss">
/* Contenedor visual del listado. La TABLA (y su zebra/header/hover) la aporta
   ahora el componente compartido ListingDataView — fuente canónica del
   estándar visual cargo/shipment — por lo que aquí no se redefine el aspecto
   de la tabla. El propio componente gestiona su scroll interno en modo
   infinito; no se fuerza max-height para no colisionar con él.

   IMPORTANTE: este wrapper debe ser un pass-through flex. `.dsh-main` es
   `display:flex; flex-direction:column` y clipa su alto al viewport cuando
   contiene una `.sdv-card`. La `.sdv-card` que emite ListingDataView usa
   `flex:1 1 auto; min-height:0` para llenar ese alto y scrollear su tabla
   internamente — pero eso solo funciona si su padre también propaga el alto
   acotado. Sin `flex:1/min-height:0/display:flex` aquí, el wrapper colapsa a
   la altura del contenido y la tabla no puede scrollear (bug del listado). */
.invoice-list-card {
  width: 100%;
  margin: 16px auto 0;
  background: transparent;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Valor clicable-para-filtrar: se lee como texto normal de la celda y solo al
   hover/focus revela que es accionable. Mismo patrón que cargo/shipment. */
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
.invoice-tabs-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}
.invoice-tabs-field {
  max-width: 260px;
}
.invoice-client-btn {
  max-width: 280px;
}

/* ViewModeToggle (paginado/scroll) — réplica de `.sdv-mode-toggle` /
   `.sdv-mode-btn` de mockup2.scss (namespace `.shipment-v2`, no cargado por
   invoicing). `:deep` porque el toggle es un componente hijo. */
:deep(.sdv-mode-toggle) {
  display: inline-flex;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  padding: 2px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  gap: 2px;
}
:deep(.sdv-mode-btn) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: rgb(var(--v-theme-on-surface-variant));
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}
:deep(.sdv-mode-btn:hover) {
  color: rgb(var(--v-theme-on-surface));
}
:deep(.sdv-mode-btn.is-active) {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

/* Botón "Advanced filters" del sidebar — réplica de las clases globales
   `.sidebar-action` / `.filters-card-badge` de mockup2.scss (namespace
   `.shipment-v2`), que invoicing no carga. Scoped a la página para no
   depender del shell de shipment y mantener paridad visual exacta con
   cargo/shipment. */
.sidebar-action {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 10px;
  padding: 10px 11px;
  border: 0;
  border-radius: 11px;
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface));
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
  text-align: left;
  position: relative;
}
.sidebar-action:hover {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}
.sidebar-action-label {
  flex: 1;
}
.sidebar-action--rail {
  justify-content: center;
  padding: 10px 6px;
}
.filters-card-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 10.5px;
  font-weight: 700;
  margin-left: 2px;
}
.sidebar-action--rail .filters-card-badge {
  position: absolute;
  top: 4px;
  right: 4px;
}
</style>
