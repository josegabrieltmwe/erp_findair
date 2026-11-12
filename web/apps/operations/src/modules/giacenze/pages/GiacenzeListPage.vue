<template>
  <div class="giac-page">
    <!-- ── Colas de trabajo (primero lo que hay que hacer) ─────────── -->
    <nav
      class="giac-queues"
      :aria-label="t('giacenze.giacenze.queue.title')"
      data-testid="giac-queues"
    >
      <v-btn
        v-for="q in queueIds"
        :key="q"
        size="small"
        :variant="store.queue === q ? 'flat' : 'tonal'"
        :color="store.queue === q ? 'primary' : undefined"
        :data-testid="`giac-queue-${q}`"
        @click="pickQueue(q)"
      >
        {{ t(`giacenze.giacenze.queue.${q}`) }}
        <span v-if="queueCount(q) !== null" class="giac-queue__count">{{
          queueCount(q)
        }}</span>
        <span
          v-else-if="q !== 'all'"
          class="giac-queue__count giac-queue__count--na"
          >n/d</span
        >
      </v-btn>
      <v-spacer />
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-filter-variant"
        @click="showFilters = !showFilters"
      >
        {{ t("giacenze.giacenze.filters") }}
      </v-btn>
    </nav>
    <p
      v-if="store.queue"
      class="giac-queue__hint"
      data-testid="giac-queue-hint"
    >
      {{ t(`giacenze.giacenze.queue.hint.${store.queue}`) }}
    </p>

    <!-- ── Contexto de envío (llegada desde la ficha del envío) ───── -->
    <v-alert
      v-if="shipmentContext"
      type="info"
      variant="tonal"
      density="compact"
      data-testid="giac-shipment-banner"
    >
      {{ t("giacenze.giacenze.shipmentBanner", { id: shipmentContext }) }}
      <template #append>
        <v-btn variant="text" size="small" @click="clearShipmentContext">{{
          t("giacenze.giacenze.showAll")
        }}</v-btn>
        <v-btn
          variant="text"
          size="small"
          :href="detailHref('shipment', shipmentContext)"
          >{{ t("giacenze.giacenze.backToShipment") }}</v-btn
        >
      </template>
    </v-alert>

    <!-- ── Filtros adicionales ─────────────────────────────────────── -->
    <section v-if="showFilters" class="giac-filters" data-testid="giac-filters">
      <v-text-field
        v-model.number="local.id_spedizione"
        :label="t('giacenze.giacenze.shipmentId')"
        type="number"
        density="comfortable"
        clearable
        hide-details
        class="giac-filter-field"
        @keyup.enter="applyFilters"
      />
      <v-text-field
        v-model="local.q"
        :label="t('giacenze.giacenze.searchText')"
        density="comfortable"
        clearable
        hide-details
        class="giac-filter-field"
        @keyup.enter="applyFilters"
      />
      <CmAnagraficaAutocomplete
        v-model="local.id_cliente"
        :label="t('giacenze.giacenze.client')"
        class="giac-filter-field giac-filter-field--wide"
        @select="onClientSelect"
      />
      <v-select
        v-model="local.operazione"
        :items="operationItems"
        :label="t('giacenze.giacenze.operation')"
        density="comfortable"
        clearable
        hide-details
        class="giac-filter-field"
      />
      <v-text-field
        v-model="local.data_open_da"
        :label="t('giacenze.giacenze.fromDate')"
        type="date"
        density="comfortable"
        clearable
        hide-details
        class="giac-filter-field"
      />
      <v-text-field
        v-model="local.data_open_a"
        :label="t('giacenze.giacenze.toDate')"
        type="date"
        density="comfortable"
        clearable
        hide-details
        class="giac-filter-field"
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

    <!-- ── Filtros activos ─────────────────────────────────────────── -->
    <ActiveFilterChips
      :filters="activeFilters"
      @remove="removeFilter"
      @clear="clearFilters"
    />

    <!-- ── Aging ───────────────────────────────────────────────────── -->
    <section v-if="agingTiles.length" class="giac-aging">
      <ListingKpiStrip :tiles="agingTiles" />
    </section>

    <!-- ── Toolbar ─────────────────────────────────────────────────── -->
    <div class="giac-toolbar">
      <div class="giac-toolbar-title">
        <span class="giac-count">{{ store.total }}</span>
        <span class="giac-count-label">{{ t("giacenze.giacenze.title") }}</span>
      </div>
      <v-spacer />
      <template v-if="selected.length">
        <span class="giac-selected">{{
          t("giacenze.giacenze.bulk.selected", { count: selected.length })
        }}</span>
        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-check-circle-outline"
          :loading="bulkBusy"
          data-testid="giac-bulk-close"
          @click="bulkClose"
        >
          {{ t("giacenze.giacenze.bulk.close") }}
        </v-btn>
        <v-btn variant="text" @click="selected = []">{{
          t("giacenze.giacenze.bulk.clear")
        }}</v-btn>
      </template>
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
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        data-testid="giac-new"
        @click="createOpen = true"
      >
        {{ t("giacenze.giacenze.new") }}
      </v-btn>
    </div>

    <!-- ── Tabla ───────────────────────────────────────────────────── -->
    <v-data-table
      v-model="selected"
      :headers="headers"
      :items="store.items"
      :loading="store.loading"
      item-value="id"
      show-select
      class="giac-table"
      hover
      :row-props="rowProps"
      @click:row="onRowClick"
    >
      <template #no-data>
        <p class="giac-empty" data-testid="giac-empty">{{ emptyText }}</p>
      </template>

      <template #[`item.id_spedizione`]="{ item }">
        <a
          v-if="item.id_spedizione"
          class="giac-link"
          :href="detailHref('shipment', item.id_spedizione)"
          :title="t('giacenze.giacenze.openShipment')"
          @click.stop
          >{{ item.id_spedizione }}</a
        >
        <span v-else>—</span>
      </template>

      <template #[`item.step`]="{ item }">
        <v-chip
          size="small"
          label
          :color="stepColor(item)"
          :data-testid="`giac-step-${item.id}`"
        >
          {{ t(`giacenze.giacenze.step.${lifecycleStep(item)}`) }}
        </v-chip>
      </template>

      <template #[`item.cont_cliente_data`]="{ item }">
        <v-chip
          v-if="hasDate(item.cont_cliente_data)"
          size="x-small"
          color="success"
          variant="tonal"
          >{{ t("giacenze.giacenze.yes") }}</v-chip
        >
        <v-chip v-else size="x-small" color="warning" variant="tonal">{{
          t("giacenze.giacenze.no")
        }}</v-chip>
      </template>

      <template #[`item.risp_cliente_data`]="{ item }">
        <v-chip
          v-if="hasDate(item.risp_cliente_data)"
          size="x-small"
          color="success"
          variant="tonal"
          >{{ t("giacenze.giacenze.replied") }}</v-chip
        >
        <v-chip v-else size="x-small" color="warning" variant="tonal">{{
          t("giacenze.giacenze.awaitingReply")
        }}</v-chip>
      </template>

      <template #[`item.cont_fornitore_data`]="{ item }">
        <v-chip
          v-if="hasDate(item.cont_fornitore_data)"
          size="x-small"
          color="success"
          variant="tonal"
          >{{ t("giacenze.giacenze.yes") }}</v-chip
        >
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

      <template #[`item.addebito_riconsegna`]="{ item }">{{
        formatCharge(item)
      }}</template>
      <template #[`item.data_open`]="{ item }">{{
        item.data_open ?? "—"
      }}</template>
      <template #[`item.data_close`]="{ item }">{{
        hasDate(item.data_close) ? item.data_close : "—"
      }}</template>
      <template #[`item.actions`]="{ item }">
        <span @click.stop><CmRowActions :actions="rowActions(item)" /></span>
      </template>
    </v-data-table>

    <div v-if="pageCount > 1" class="giac-pagination">
      <v-pagination
        :model-value="store.page"
        :length="pageCount"
        :total-visible="7"
        density="comfortable"
        @update:model-value="goToPage"
      />
    </div>

    <GiacenzaCreateDialog v-model="createOpen" @created="onCreated" />
    <GiacenzaEditDialog
      v-model="dialogOpen"
      :giacenza="editing"
      @changed="onChanged"
      @next="openNext"
    />

    <!-- ── Auto-cierre (admin) ─────────────────────────────────────── -->
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
          <v-btn
            color="primary"
            :loading="store.saving"
            @click="runAutoClose"
            >{{ t("common.confirm") }}</v-btn
          >
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
import CmAnagraficaAutocomplete from "@shared/listini/components/CmAnagraficaAutocomplete.vue";
import { detailHref } from "@shared/platform/navTargets";
import {
  mdiPencil,
  mdiCheckCircleOutline,
  mdiDeleteOutline,
  mdiLockOpenVariantOutline,
} from "@mdi/js";
import type { ActiveFilter } from "@shared/listing/types";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import { useConfirmStore } from "@shared/anagrafiche/stores/confirm.store";
import { useGiacenzeStore } from "../stores/giacenze.store";
import { giacenzeService } from "../services/giacenze.service";
import GiacenzaEditDialog from "../components/GiacenzaEditDialog.vue";
import GiacenzaCreateDialog from "../components/GiacenzaCreateDialog.vue";
import {
  DEFAULT_QUEUE,
  QUEUE_ORDER,
  hasDate,
  isStale,
  lifecycleStep,
  queueFromIndicator,
  type QueueId,
} from "../queues";
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
const queueIds = QUEUE_ORDER;

/** Indicadores antiguos de la home que no son una cola: se aplican como filtro libre. */
const FREE_INDICATORS = new Set(["giacenze_overdue_15"]);

// ── Filtros secundarios (las colas viven en el store) ─────────
const local = reactive<GiacenzaFilters>(emptyFilters());
const clientLabel = ref("");
const showFilters = ref(false);
const selected = ref<number[]>([]);
const bulkBusy = ref(false);

const operationItems = computed(() =>
  GIACENZA_OPERATIONS.map((op) => ({ title: operationLabel(op), value: op })),
);

const showClose = computed(
  () => store.queue === "closed" || store.queue === "all",
);
const headers = computed(() => {
  const cols: Array<Record<string, unknown>> = [
    {
      title: t("giacenze.giacenze.nextStep"),
      key: "step",
      sortable: false,
      width: 190,
    },
    {
      title: t("giacenze.giacenze.shipment"),
      key: "id_spedizione",
      width: 100,
    },
    { title: t("giacenze.giacenze.client"), key: "cliente_rag_soc" },
    {
      title: t("giacenze.giacenze.tracking"),
      key: "tracking_descr",
      width: 160,
    },
    { title: t("giacenze.giacenze.dataOpen"), key: "data_open", width: 110 },
    { title: t("giacenze.giacenze.days"), key: "giacenza_gg", width: 80 },
    {
      title: t("giacenze.giacenze.clientNotified"),
      key: "cont_cliente_data",
      sortable: false,
      width: 110,
    },
    {
      title: t("giacenze.giacenze.clientReply"),
      key: "risp_cliente_data",
      sortable: false,
      width: 120,
    },
    {
      title: t("giacenze.giacenze.supplierNotified"),
      key: "cont_fornitore_data",
      sortable: false,
      width: 110,
    },
    { title: t("giacenze.giacenze.operation"), key: "operazione", width: 120 },
    {
      title: t("giacenze.giacenze.redeliveryCharge"),
      key: "addebito_riconsegna",
      width: 130,
      align: "end",
    },
  ];
  if (showClose.value)
    cols.splice(5, 0, {
      title: t("giacenze.giacenze.dataClose"),
      key: "data_close",
      width: 110,
    });
  cols.push({
    title: t("common.actions"),
    key: "actions",
    sortable: false,
    align: "end",
    width: 90,
  });
  return cols;
});

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
const createOpen = ref(false);
const editing = ref<Giacenza | null>(null);
const autoCloseOpen = ref(false);
const autoCloseDays = ref(30);

/** Envío de contexto cuando se llega desde su ficha (`?sped=`). */
const shipmentContext = computed(() => store.filters.id_spedizione ?? null);

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

function stepColor(item: Giacenza): string {
  switch (lifecycleStep(item)) {
    case "closed":
      return "grey";
    case "ready_to_close":
      return "success";
    default:
      return "warning";
  }
}

function rowProps(data: { item: Giacenza }): Record<string, unknown> {
  return { class: isStale(data.item) ? "giac-row--stale" : "" };
}

function queueCount(q: QueueId): number | null {
  if (q === "all") return null;
  const n = store.queueCounts[q];
  return typeof n === "number" ? n : null;
}

const emptyText = computed(() => {
  if (store.queue === "to_notify")
    return t("giacenze.giacenze.empty.to_notify");
  return t("giacenze.giacenze.empty.generic");
});

function formatCharge(item: Giacenza): string {
  const amount =
    item.addebito_riconsegna_display ?? item.addebito_riconsegna ?? 0;
  if (!amount) return "—";
  const currency = item.addebito_riconsegna_currency ?? "EUR";
  return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function fail(error: unknown): void {
  const msg = error instanceof Error && error.message ? error.message : "";
  toast.error(msg || t("giacenze.giacenze.messages.actionFailed"));
}

/** Aplica los filtros secundarios conservando los que fija la cola. */
function applyFilters(): void {
  store.setFilters({
    ...local,
    indicator: store.filters.indicator,
    closed: store.filters.closed,
  });
  selected.value = [];
  void store.fetchList();
}

function onClientSelect(o: { rag_soc?: string } | null): void {
  clientLabel.value = o?.rag_soc ?? "";
}

function pickQueue(q: QueueId): void {
  store.selectQueue(q);
  applyFilters();
}

// ── Click-to-filter ──────────────────────────────────────────
function setFilterFromCell(
  field: "operazione",
  value: number | string | null,
): void {
  if (value == null || value === "") return;
  local[field] = value as GiacenzaOperation;
  applyFilters();
}

const activeFilters = computed<ActiveFilter[]>(() => {
  const out: ActiveFilter[] = [];
  const add = (field: string, group: string, value: string): void => {
    out.push({ field, group, value });
  };
  if (local.id_spedizione != null)
    add(
      "id_spedizione",
      t("giacenze.giacenze.shipment") as string,
      String(local.id_spedizione),
    );
  if (local.id_cliente != null)
    add(
      "id_cliente",
      t("giacenze.giacenze.client") as string,
      clientLabel.value || String(local.id_cliente),
    );
  if (local.q) add("q", t("giacenze.giacenze.searchText") as string, local.q);
  if (local.operazione)
    add(
      "operazione",
      t("giacenze.giacenze.operation") as string,
      operationLabel(local.operazione),
    );
  if (local.data_open_da)
    add(
      "data_open_da",
      t("giacenze.giacenze.fromDate") as string,
      local.data_open_da,
    );
  if (local.data_open_a)
    add(
      "data_open_a",
      t("giacenze.giacenze.toDate") as string,
      local.data_open_a,
    );
  if (store.queue === null && store.filters.indicator)
    add(
      "indicator",
      t("giacenze.giacenze.indicator") as string,
      store.filters.indicator,
    );
  return out;
});

function removeFilter(field: string): void {
  if (field === "indicator") {
    store.selectQueue("all");
  } else if (field === "id_spedizione" || field === "id_cliente") {
    local[field] = null;
    if (field === "id_cliente") clientLabel.value = "";
  } else if (
    field === "q" ||
    field === "data_open_da" ||
    field === "data_open_a" ||
    field === "operazione"
  ) {
    local[field] = null;
  }
  applyFilters();
}

function clearShipmentContext(): void {
  removeFilter("id_spedizione");
}

function clearFilters(): void {
  Object.assign(local, emptyFilters());
  clientLabel.value = "";
  store.selectQueue("all");
  applyFilters();
}

function goToPage(p: number): void {
  store.setPage(p);
  void store.fetchList();
}

function refresh(): void {
  void Promise.all([
    store.fetchList(),
    store.fetchAging(),
    store.fetchQueueCounts(),
  ]);
}

function onRowClick(_e: Event, row: { item: Giacenza }): void {
  openEdit(row.item);
}

function openEdit(item: Giacenza): void {
  editing.value = item;
  dialogOpen.value = true;
}

/** «Apri la prossima»: tras resolver una giacenza de la cola, abre la siguiente de la lista. */
function openNext(currentId: number): void {
  const list = store.items;
  const i = list.findIndex((g) => g.id === currentId);
  const next = i >= 0 ? list[i + 1] : undefined;
  if (next) {
    editing.value = next;
    dialogOpen.value = true;
  } else {
    dialogOpen.value = false;
  }
}

/** Acciones de fila: abrir, cerrar o reabrir según el estado, eliminar. */
function rowActions(item: Giacenza): RowAction[] {
  const closed = lifecycleStep(item) === "closed";
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
      hidden: closed,
      onClick: () => confirmClose(item),
    },
    {
      key: "reopen",
      title: t("giacenze.giacenze.reopen"),
      icon: mdiLockOpenVariantOutline,
      hidden: !closed,
      onClick: () => confirmReopen(item),
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

function onCreated(g: Giacenza): void {
  toast.success(t("giacenze.giacenze.messages.created"));
  refresh();
  // Abre la ficha recién creada (o la que ya estaba abierta para ese envío).
  editing.value = g;
  dialogOpen.value = true;
}

function onChanged(): void {
  refresh();
}

async function confirmClose(item: Giacenza): Promise<void> {
  const ok = await confirm.ask({
    title: t("giacenze.giacenze.closeHold"),
    message: t("giacenze.giacenze.messages.closeConfirm"),
    confirmLabel: t("giacenze.giacenze.closeHold"),
  });
  if (!ok) return;
  try {
    await store.close(item.id);
    await store.fetchQueueCounts();
    toast.success(t("giacenze.giacenze.messages.closed"));
  } catch (e) {
    fail(e);
  }
}

async function confirmReopen(item: Giacenza): Promise<void> {
  const ok = await confirm.ask({
    title: t("giacenze.giacenze.reopen"),
    message: t("giacenze.giacenze.messages.reopenConfirm"),
    confirmLabel: t("giacenze.giacenze.reopen"),
  });
  if (!ok) return;
  try {
    await store.reopen(item.id);
    toast.success(t("giacenze.giacenze.messages.reopened"));
  } catch (e) {
    fail(e);
  }
}

async function confirmDelete(item: Giacenza): Promise<void> {
  const ok = await confirm.ask({
    title: t("common.delete"),
    message: t("giacenze.giacenze.messages.deleteConfirm"),
    confirmLabel: t("common.delete"),
    variant: "danger",
  });
  if (!ok) return;
  try {
    await store.remove(item.id);
    await store.fetchQueueCounts();
    toast.success(t("giacenze.giacenze.messages.deleted"));
  } catch (e) {
    fail(e);
  }
}

/** Cierre en bloque: una a una, con resumen de las que fallan. */
async function bulkClose(): Promise<void> {
  const ids = selected.value.filter((id) => {
    const g = store.items.find((x) => x.id === id);
    return g && lifecycleStep(g) !== "closed";
  });
  if (ids.length === 0) {
    toast.error(t("giacenze.giacenze.bulk.nothingToClose"));
    return;
  }
  const ok = await confirm.ask({
    title: t("giacenze.giacenze.bulk.close"),
    message: t("giacenze.giacenze.bulk.closeConfirm", { count: ids.length }),
    confirmLabel: t("giacenze.giacenze.closeHold"),
  });
  if (!ok) return;
  bulkBusy.value = true;
  const failed: number[] = [];
  for (const id of ids) {
    try {
      await giacenzeService.close(id);
    } catch {
      failed.push(id);
    }
  }
  bulkBusy.value = false;
  selected.value = failed;
  refresh();
  if (failed.length === 0) {
    toast.success(t("giacenze.giacenze.bulk.done", { count: ids.length }));
  } else {
    toast.error(
      t("giacenze.giacenze.bulk.partial", {
        ok: ids.length - failed.length,
        failed: failed.length,
        ids: failed.join(", "),
      }),
    );
  }
}

function openAutoClose(): void {
  autoCloseDays.value = 30;
  autoCloseOpen.value = true;
}

async function runAutoClose(): Promise<void> {
  try {
    const closed = await store.autoClose(autoCloseDays.value);
    toast.success(
      t("giacenze.giacenze.messages.autoClosed", { count: closed }, closed),
    );
    void store.fetchQueueCounts();
  } catch (e) {
    fail(e);
  } finally {
    autoCloseOpen.value = false;
  }
}

/** Deep-link ?id=N: carga la giacenza y abre su ficha. */
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
  const one = (v: unknown): string =>
    String(Array.isArray(v) ? v[0] : (v ?? ""));
  const indicator = one(route.query.indicator);
  const sped = Number(one(route.query.sped));
  const hasId = Number(one(route.query.id)) > 0;

  if (Number.isFinite(sped) && sped > 0) {
    // Llegada desde la ficha del envío: todas las giacenze de ese envío.
    local.id_spedizione = sped;
    store.selectQueue("all");
  } else if (indicator) {
    const q = queueFromIndicator(indicator);
    if (q) store.selectQueue(q);
    else if (FREE_INDICATORS.has(indicator)) {
      store.selectQueue("all");
      store.queue = null;
      store.filters = {
        ...store.filters,
        indicator: indicator as GiacenzaFilters["indicator"],
      };
    } else store.selectQueue(DEFAULT_QUEUE);
  } else if (hasId) {
    store.selectQueue("all");
  } else {
    store.selectQueue(DEFAULT_QUEUE);
  }
  applyFilters();
  void Promise.all([store.fetchAging(), store.fetchQueueCounts()]);
  void openFromDeepLink();
});
</script>

<style scoped>
.giac-queues {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.giac-queue__count {
  margin-left: 6px;
  font-weight: 700;
}
.giac-queue__count--na {
  opacity: 0.6;
  font-weight: 400;
}
.giac-queue__hint {
  margin: -8px 0 0;
  font-size: 0.85rem;
  color: var(--cm-text-secondary, #64748b);
}
.giac-filter-field--wide {
  max-width: 280px;
  flex: 1 1 220px;
}
.giac-link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
.giac-link:hover {
  text-decoration: underline;
}
.giac-selected {
  font-size: 0.9rem;
}
.giac-empty {
  padding: 24px 12px;
  color: var(--cm-text-secondary, #64748b);
}
.giac-table :deep(tr.giac-row--stale) {
  background: rgba(var(--v-theme-warning), 0.08);
}
.giac-table :deep(tbody tr) {
  cursor: pointer;
}
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
