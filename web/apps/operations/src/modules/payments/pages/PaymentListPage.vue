<template>
  <div class="pay-page">
    <div class="pay-toolbar">
      <v-tabs
        :model-value="store.view"
        density="comfortable"
        color="primary"
        @update:model-value="onViewChange"
      >
        <v-tab value="credit" prepend-icon="mdi-cash-plus">{{
          t("payments.list.view_credit")
        }}</v-tab>
        <v-tab value="debit" prepend-icon="mdi-cash-minus">{{
          t("payments.list.view_debit")
        }}</v-tab>
        <v-tab value="overdue" prepend-icon="mdi-clock-alert-outline">{{
          t("payments.list.view_overdue")
        }}</v-tab>
      </v-tabs>
      <v-spacer />
      <v-btn
        variant="tonal"
        prepend-icon="mdi-chart-bar"
        :to="{ name: 'payments-aging' }"
      >
        {{ t("payments.nav.aging") }}
      </v-btn>
      <v-btn
        variant="tonal"
        prepend-icon="mdi-email-alert-outline"
        :to="{ name: 'payments-reminders' }"
      >
        {{ t("payments.nav.reminders") }}
      </v-btn>
      <v-btn
        v-if="caps.canReconcile"
        variant="tonal"
        prepend-icon="mdi-bank-transfer"
        :to="{ name: 'payments-reconciliation' }"
      >
        {{ t("payments.nav.reconciliation") }}
      </v-btn>
    </div>

    <!-- Filtros -->
    <section class="pay-filters">
      <div class="pay-field pay-field--wide">
        <CustomerPicker
          :model-value="store.filters.id_anagrafica"
          :label="t('payments.list.customer')"
          @update:model-value="(v) => store.setFilters({ id_anagrafica: v })"
        />
      </div>
      <v-select
        v-if="store.view !== 'overdue'"
        :model-value="store.query.statop"
        :items="statusItems"
        :label="t('payments.list.status')"
        density="comfortable"
        variant="outlined"
        clearable
        hide-details
        class="pay-field"
        @update:model-value="
          (v) => store.setFilters({ statop: v ?? undefined })
        "
      />
      <v-select
        v-else
        :model-value="
          store.filters.statop === '10' || store.filters.statop === '30'
            ? store.filters.statop
            : null
        "
        :items="overdueItems"
        :label="t('payments.list.overdue_days')"
        density="comfortable"
        variant="outlined"
        clearable
        hide-details
        class="pay-field"
        @update:model-value="
          (v) => store.setFilters({ statop: v ?? undefined })
        "
      />
      <v-select
        :model-value="store.filters.id_pagam_metodi"
        :items="store.methods"
        item-title="label"
        item-value="id"
        :label="t('payments.list.method')"
        density="comfortable"
        variant="outlined"
        clearable
        hide-details
        class="pay-field"
        @update:model-value="
          (v) => store.setFilters({ id_pagam_metodi: v ?? null })
        "
      />
      <v-text-field
        :model-value="store.filters.scad_dal"
        type="date"
        :label="t('payments.list.due_from')"
        density="comfortable"
        variant="outlined"
        clearable
        hide-details
        class="pay-field"
        @update:model-value="
          (v) => store.setFilters({ scad_dal: v || undefined })
        "
      />
      <v-text-field
        :model-value="store.filters.scad_al"
        type="date"
        :label="t('payments.list.due_to')"
        density="comfortable"
        variant="outlined"
        clearable
        hide-details
        class="pay-field"
        @update:model-value="
          (v) => store.setFilters({ scad_al: v || undefined })
        "
      />
      <v-text-field
        :model-value="store.filters.close_dal"
        type="date"
        :label="t('payments.list.closed_from')"
        density="comfortable"
        variant="outlined"
        clearable
        hide-details
        class="pay-field"
        @update:model-value="
          (v) => store.setFilters({ close_dal: v || undefined })
        "
      />
      <v-text-field
        :model-value="store.filters.close_al"
        type="date"
        :label="t('payments.list.closed_to')"
        density="comfortable"
        variant="outlined"
        clearable
        hide-details
        class="pay-field"
        @update:model-value="
          (v) => store.setFilters({ close_al: v || undefined })
        "
      />
      <v-text-field
        :model-value="store.filters.importo"
        type="number"
        step="0.01"
        :label="t('payments.list.amount')"
        density="comfortable"
        variant="outlined"
        clearable
        hide-details
        class="pay-field"
        @update:model-value="onAmountFilter"
      />
      <v-btn variant="text" @click="store.resetFilters()">{{
        t("payments.list.clear_filters")
      }}</v-btn>
    </section>

    <!-- Resumen + acciones -->
    <div class="pay-summary">
      <div>
        <span class="pay-count">{{ store.total }}</span>
        <span class="text-medium-emphasis ms-2">{{
          t("payments.list.installments")
        }}</span>
        <span class="ms-4 text-medium-emphasis">
          {{ t("payments.list.total_amount") }}:
          <strong class="text-high-emphasis">{{
            money(store.totalAmount)
          }}</strong>
        </span>
      </div>
      <v-spacer />
      <v-btn
        v-if="caps.canCollect && store.selected.length"
        color="primary"
        prepend-icon="mdi-cash-check"
        @click="bulkOpen = true"
      >
        {{
          t("payments.list.collect_selected", { count: store.selected.length })
        }}
      </v-btn>
      <v-btn
        v-if="caps.canRead"
        variant="tonal"
        prepend-icon="mdi-file-delimited-outline"
        :loading="exporting"
        @click="exportCsv"
      >
        {{ t("payments.list.export_csv") }}
      </v-btn>
      <v-btn
        variant="text"
        icon="mdi-refresh"
        :title="t('common.refresh')"
        @click="store.load()"
      />
    </div>

    <v-alert v-if="store.error" type="error" variant="tonal" density="compact">
      {{ t("payments.list.load_failed") }}
    </v-alert>

    <v-data-table-server
      :headers="headers"
      :items="store.rows"
      :items-length="store.total"
      :loading="store.loading"
      :items-per-page="store.perPage"
      :items-per-page-options="[10, 25, 50, 100]"
      :page="store.page"
      :sort-by="[
        { key: sortKey, order: store.sortDir === 'ASC' ? 'asc' : 'desc' },
      ]"
      :model-value="store.selected"
      :no-data-text="t('payments.list.empty')"
      :show-select="caps.canCollect"
      item-value="id"
      :item-selectable="isSelectable"
      hover
      class="pay-table"
      @update:model-value="store.setSelected"
      @update:page="store.setPage"
      @update:items-per-page="store.setPerPage"
      @update:sort-by="onSort"
      @click:row="onRowClick"
    >
      <template #[`item.numero`]="{ item }">
        <span class="font-weight-medium">{{ item.numero }}</span>
        <div class="text-caption text-medium-emphasis">
          {{ item.data_fattura }}
        </div>
      </template>
      <template #[`item.importo`]="{ item }">{{ rowAmount(item) }}</template>
      <template #[`item.scadenza`]="{ item }">
        {{ item.scadenza }}
        <div v-if="item.status === 'overdue'" class="text-caption text-error">
          {{ t("payments.list.days_overdue", { days: item.days_overdue }) }}
        </div>
      </template>
      <template #[`item.data_close`]="{ item }">{{
        isOpenRow(item) ? "—" : item.data_close
      }}</template>
      <template #[`item.id_pagam_metodi`]="{ item }">{{
        methodLabel(item.id_pagam_metodi)
      }}</template>
      <template #[`item.status`]="{ item }">
        <v-chip
          :color="statusColor(item.status)"
          size="small"
          label
          variant="tonal"
        >
          {{ t(`payments.status.${item.status}`) }}
        </v-chip>
      </template>
      <template #[`item.actions`]="{ item }">
        <v-btn
          v-if="caps.canCollect && isOpenRow(item)"
          size="small"
          variant="tonal"
          color="primary"
          @click.stop="openCollect(item)"
        >
          {{ t("payments.actions.collect") }}
        </v-btn>
      </template>
    </v-data-table-server>

    <CollectDialog
      v-model="collectOpen"
      :payment="collectTarget"
      :methods="store.methods"
      :currency="collectTarget?.valuta_sigla"
      @collected="store.load()"
    />
    <BulkCollectDialog
      v-model="bulkOpen"
      :rows="store.selectedRows"
      @collected="onBulkDone"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  usePaymentsStore,
  isOpenRow,
  type PaymentView,
} from "../stores/payments.store";
import { useToastStore } from "../stores/toast.store";
import { paymentsApi, toCsv, downloadCsv } from "../services/payments.service";
import { capabilities } from "../env";
import CustomerPicker from "../components/CustomerPicker.vue";
import CollectDialog from "../components/CollectDialog.vue";
import BulkCollectDialog from "../components/BulkCollectDialog.vue";
import type {
  PaymentRow,
  PaymentSortKey,
  PaymentStatop,
  PaymentStatus,
} from "../types";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const store = usePaymentsStore();
const toasts = useToastStore();
const caps = capabilities();

const collectOpen = ref(false);
const collectTarget = ref<PaymentRow | null>(null);
const bulkOpen = ref(false);
const exporting = ref(false);

const statusItems = computed(() =>
  (["O", "C", "SC"] as const).map((v) => ({
    value: v,
    title: t(`payments.statop.${v}`),
  })),
);
const overdueItems = computed(() =>
  (["10", "30"] as const).map((v) => ({
    value: v,
    title: t(`payments.statop.${v}`),
  })),
);

const headers = computed(() => [
  { title: t("payments.col.invoice"), key: "numero", sortable: true },
  { title: t("payments.col.customer"), key: "rag_soc", sortable: true },
  {
    title: t("payments.col.amount"),
    key: "importo",
    align: "end" as const,
    sortable: true,
  },
  { title: t("payments.col.due"), key: "scadenza", sortable: true },
  { title: t("payments.col.closed"), key: "data_close", sortable: true },
  { title: t("payments.col.method"), key: "id_pagam_metodi", sortable: false },
  { title: t("payments.col.status"), key: "status", sortable: false },
  { title: "", key: "actions", sortable: false, align: "end" as const },
]);

const SORTABLE: PaymentSortKey[] = [
  "scadenza",
  "importo",
  "data_close",
  "numero",
  "data_fattura",
  "rag_soc",
  "id",
];
const sortKey = computed(() => store.sort);

function isSelectable(item: PaymentRow): boolean {
  return isOpenRow(item);
}

function onSort(v: { key: string; order?: "asc" | "desc" | boolean }[]): void {
  const first = v[0];
  if (!first || !SORTABLE.includes(first.key as PaymentSortKey)) {
    store.setSort("scadenza", "ASC");
    return;
  }
  store.setSort(
    first.key as PaymentSortKey,
    first.order === "desc" ? "DESC" : "ASC",
  );
}

function onAmountFilter(v: string | number | null): void {
  const n = v === null || v === "" ? null : Number(v);
  store.setFilters({ importo: n !== null && Number.isFinite(n) ? n : null });
}

function onViewChange(v: unknown): void {
  const view = v as PaymentView;
  if (view === store.view) return;
  // Al cambiar de vista el filtro de estado cambia de significado: se limpia.
  store.filters = { ...store.filters, statop: undefined };
  store.setView(view);
}

function money(v: number, cur?: string): string {
  const n = Number(v ?? 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cur ? `${n} ${cur}` : n;
}

function rowAmount(row: PaymentRow): string {
  return money(row.importo, row.valuta_sigla);
}

function methodLabel(id: number | null): string {
  if (!id) return "—";
  return store.methods.find((m) => m.id === Number(id))?.label ?? `#${id}`;
}

function statusColor(s: PaymentStatus): string {
  return (
    ({ paid: "success", overdue: "error", pending: "warning" } as const)[s] ??
    "grey"
  );
}

function openCollect(row: PaymentRow): void {
  collectTarget.value = row;
  collectOpen.value = true;
}

function onBulkDone(): void {
  store.setSelected([]);
  void store.load();
}

function onRowClick(_e: Event, ctx: { item: PaymentRow }): void {
  void router.push({
    name: "invoicing-detail",
    params: { id: String(ctx.item.id_fattura) },
  });
}

async function exportCsv(): Promise<void> {
  exporting.value = true;
  try {
    const all = await paymentsApi.listAll(store.query, {
      sort: store.sort,
      sortDir: store.sortDir,
    });
    const head = [
      t("payments.col.invoice"),
      t("payments.col.invoice_date"),
      t("payments.col.customer"),
      t("payments.col.amount"),
      t("payments.col.currency"),
      t("payments.col.due"),
      t("payments.col.closed"),
      t("payments.col.method"),
      t("payments.col.status"),
    ];
    const rows = all.map((r) => [
      r.numero,
      r.data_fattura,
      r.rag_soc,
      r.importo.toFixed(2),
      r.valuta_sigla,
      r.scadenza,
      isOpenRow(r) ? "" : r.data_close,
      methodLabel(r.id_pagam_metodi),
      t(`payments.status.${r.status}`),
    ]);
    downloadCsv(toCsv(head, rows), `payments_${store.view}.csv`);
  } catch (e) {
    toasts.push("error", e instanceof Error ? e.message : String(e));
  } finally {
    exporting.value = false;
  }
}

/** Aplica los filtros recibidos por URL (llegada desde antigüedad de saldos). */
function applyRouteQuery(): void {
  const q = route.query;
  const next = { ...store.filters };
  if (typeof q.statop === "string") next.statop = q.statop as PaymentStatop;
  if (typeof q.scad_dal === "string") next.scad_dal = q.scad_dal;
  if (typeof q.scad_al === "string") next.scad_al = q.scad_al;
  if (q.customer) next.id_anagrafica = Number(q.customer) || null;
  store.filters = next;
  if (q.view === "debit" || q.view === "credit" || q.view === "overdue") {
    store.view = q.view;
  } else if (q.statop === "SC" || q.statop === "10" || q.statop === "30") {
    store.view = "overdue";
  }
}

onMounted(() => {
  applyRouteQuery();
  void store.loadMethods();
  void store.load();
});
</script>

<style scoped>
.pay-page {
  padding: 16px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.pay-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.pay-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.pay-field {
  max-width: 190px;
  flex: 1 1 150px;
}
.pay-field--wide {
  max-width: 280px;
  flex: 1 1 220px;
}
.pay-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.pay-count {
  font-size: 1.4rem;
  font-weight: 700;
}
.pay-table :deep(tbody tr) {
  cursor: pointer;
}
</style>
