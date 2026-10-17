<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConfirmDialog from "@shared/ui/ConfirmDialog.vue";
import { useToastStore } from "@shared/stores/toast.store";
import { fetchCarriers } from "../services/cod.service";
import {
  assignReport,
  exportCod,
  fetchList,
  fetchSummary,
  reconcile,
  saveBase64File,
  type ReconList,
  type ReconRow,
  type ReconSummary,
} from "../services/reconciliation.service";
import {
  COLLECT_STATES,
  DEFAULT_COLLECT_STATE,
  isValidReportId,
  selectedTotal,
  setPageSelection,
  stateLabelKey,
  toggleSelection,
} from "../reconciliation.logic";
import { capabilities } from "../env";
import type { Carrier } from "../types";

const { t } = useI18n();
const toasts = useToastStore();
const caps = capabilities();

const today = (): string => new Date().toISOString().slice(0, 10);
const money = (v: number): string =>
  Number(v).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const tab = ref<ReconList>("pending");
const rows = ref<ReconRow[]>([]);
const total = ref(0);
const page = ref(1);
const perPage = ref(25);
const loading = ref(false);
const error = ref<string | null>(null);
const selected = ref<number[]>([]);

const dateFrom = ref("");
const dateTo = ref("");
const carrierId = ref<number | null>(null);
const carriers = ref<Carrier[]>([]);

const summary = ref<ReconSummary | null>(null);

const headers = computed(() => [
  { title: t("cod_assegni.recon.col.id"), key: "id", sortable: false },
  { title: t("cod_assegni.recon.col.awb"), key: "AWB_forn", sortable: false },
  {
    title: t("cod_assegni.recon.col.customer"),
    key: "cliente_nome",
    sortable: false,
  },
  {
    title: t("cod_assegni.recon.col.shipped"),
    key: "data_sped0",
    sortable: false,
  },
  {
    title: t("cod_assegni.recon.col.delivered"),
    key: "consegna_data",
    sortable: false,
  },
  {
    title: t("cod_assegni.recon.col.amount"),
    key: "contras_imp",
    sortable: false,
    align: "end" as const,
  },
  {
    title: t("cod_assegni.recon.col.state"),
    key: "contras_incasso",
    sortable: false,
  },
  ...(tab.value === "to_report"
    ? [
        {
          title: t("cod_assegni.recon.col.collected_on"),
          key: "contras_data_inc",
          sortable: false,
        },
      ]
    : []),
  { title: "", key: "actions", sortable: false, align: "end" as const },
]);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetchList(
      tab.value,
      {
        date_from: dateFrom.value,
        date_to: dateTo.value,
        carrier_id: carrierId.value,
      },
      page.value,
      perPage.value,
    );
    rows.value = res.items;
    total.value = res.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("cod_assegni.recon.load_failed");
  } finally {
    loading.value = false;
  }
}

async function loadSummary(): Promise<void> {
  try {
    summary.value = await fetchSummary(dateFrom.value, dateTo.value);
  } catch {
    summary.value = null;
  }
}

function refreshAll(): void {
  selected.value = [];
  void load();
  void loadSummary();
}

onMounted(async () => {
  refreshAll();
  try {
    carriers.value = await fetchCarriers();
  } catch {
    carriers.value = [];
  }
});

watch(tab, () => {
  page.value = 1;
  selected.value = [];
  void load();
});
watch([dateFrom, dateTo, carrierId], () => {
  page.value = 1;
  refreshAll();
});

function onPage(p: number): void {
  page.value = p;
  void load();
}
function onPerPage(n: number): void {
  perPage.value = n;
  page.value = 1;
  void load();
}

/* ── Selección ─────────────────────────────────────────── */
const pageIds = computed(() => rows.value.map((r) => r.id));
const allOnPage = computed(
  () =>
    pageIds.value.length > 0 &&
    pageIds.value.every((id) => selected.value.includes(id)),
);
const selTotal = computed(() => selectedTotal(rows.value, selected.value));

/* ── Marcar como cobrado ───────────────────────────────── */
const collectTarget = ref<ReconRow | null>(null);
const collectDate = ref(today());
const collectState = ref<string>(DEFAULT_COLLECT_STATE);
const collectConfirm = ref(false);
const saving = ref(false);

const stateItems = computed(() =>
  COLLECT_STATES.map((s) => ({ value: s, title: t(stateLabelKey(s)) })),
);

function openCollect(r: ReconRow): void {
  collectTarget.value = r;
  collectDate.value = today();
  collectState.value = DEFAULT_COLLECT_STATE;
}

async function doCollect(): Promise<void> {
  const r = collectTarget.value;
  if (!r) return;
  saving.value = true;
  try {
    await reconcile(r.id, collectDate.value, collectState.value);
    toasts.push("success", t("cod_assegni.recon.collect.done", { id: r.id }));
    collectConfirm.value = false;
    collectTarget.value = null;
    refreshAll();
  } catch (e) {
    collectConfirm.value = false;
    toasts.push("error", e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

/* ── Asignar a remesa ──────────────────────────────────── */
const assignOpen = ref(false);
const assignConfirm = ref(false);
const reportId = ref("");

function openAssign(): void {
  reportId.value = "";
  assignOpen.value = true;
}

async function doAssign(): Promise<void> {
  saving.value = true;
  try {
    const res = await assignReport(selected.value, Number(reportId.value));
    toasts.push(
      "success",
      t("cod_assegni.recon.assign.done", {
        count: res.count,
        report: reportId.value,
      }),
    );
    assignConfirm.value = false;
    assignOpen.value = false;
    refreshAll();
  } catch (e) {
    assignConfirm.value = false;
    toasts.push("error", e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

/* ── Exportar ──────────────────────────────────────────── */
const exportOpen = ref(false);
const exportFrom = ref("");
const exportTo = ref("");
const exportFormat = ref<"xlsx" | "csv">("xlsx");
const exporting = ref(false);
const exportError = ref<string | null>(null);

function openExport(): void {
  exportFrom.value = dateFrom.value;
  exportTo.value = dateTo.value;
  exportError.value = null;
  exportOpen.value = true;
}

async function doExport(): Promise<void> {
  exporting.value = true;
  exportError.value = null;
  try {
    saveBase64File(
      await exportCod(exportFrom.value, exportTo.value, exportFormat.value),
    );
    exportOpen.value = false;
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : String(e);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="pa-4">
    <div class="d-flex align-center flex-wrap ga-2 mb-3">
      <v-btn variant="text" icon="mdi-arrow-left" :to="{ name: 'cod' }" />
      <div class="text-h6">{{ t("cod_assegni.recon.title") }}</div>
      <v-spacer />
      <v-btn
        variant="tonal"
        prepend-icon="mdi-download"
        @click="openExport"
      >
        {{ t("cod_assegni.recon.export.button") }}
      </v-btn>
    </div>

    <!-- Resumen -->
    <div v-if="summary" class="d-flex flex-wrap ga-3 mb-3">
      <v-card variant="tonal" class="pa-3">
        <div class="text-caption">{{ t("cod_assegni.recon.summary.total") }}</div>
        <div class="text-subtitle-1">
          {{ summary.total_shipments }} · {{ money(summary.total_amount) }}
        </div>
      </v-card>
      <v-card variant="tonal" color="warning" class="pa-3">
        <div class="text-caption">{{ t("cod_assegni.recon.summary.pending") }}</div>
        <div class="text-subtitle-1">
          {{ summary.pending_count }} · {{ money(summary.pending_amount) }}
        </div>
      </v-card>
      <v-card variant="tonal" color="info" class="pa-3">
        <div class="text-caption">{{ t("cod_assegni.recon.summary.to_report") }}</div>
        <div class="text-subtitle-1">{{ summary.to_report_count }}</div>
      </v-card>
      <v-card variant="tonal" color="success" class="pa-3">
        <div class="text-caption">{{ t("cod_assegni.recon.summary.reported") }}</div>
        <div class="text-subtitle-1">{{ summary.reported_count }}</div>
      </v-card>
      <v-card variant="tonal" class="pa-3">
        <div class="text-caption">{{ t("cod_assegni.recon.summary.cancelled") }}</div>
        <div class="text-subtitle-1">{{ summary.cancelled_count }}</div>
      </v-card>
    </div>

    <v-tabs v-model="tab" class="mb-3">
      <v-tab value="pending">{{ t("cod_assegni.recon.tab.pending") }}</v-tab>
      <v-tab value="to_report">{{ t("cod_assegni.recon.tab.to_report") }}</v-tab>
    </v-tabs>

    <div class="d-flex flex-wrap ga-3 mb-3 align-center">
      <v-text-field
        v-model="dateFrom"
        type="date"
        :label="t('cod_assegni.recon.filter.from')"
        density="comfortable"
        variant="outlined"
        clearable
        hide-details
        style="max-width: 190px"
      />
      <v-text-field
        v-model="dateTo"
        type="date"
        :label="t('cod_assegni.recon.filter.to')"
        density="comfortable"
        variant="outlined"
        clearable
        hide-details
        style="max-width: 190px"
      />
      <v-select
        v-model="carrierId"
        :items="carriers"
        item-title="label"
        item-value="id"
        :label="t('cod_assegni.recon.filter.carrier')"
        density="comfortable"
        variant="outlined"
        clearable
        hide-details
        style="max-width: 240px"
      />
      <v-spacer />
      <template v-if="tab === 'to_report' && caps.canWrite">
        <span v-if="selected.length" class="text-body-2">
          {{
            t("cod_assegni.recon.selected", {
              count: selected.length,
              amount: money(selTotal),
            })
          }}
        </span>
        <v-btn
          color="primary"
          prepend-icon="mdi-file-send-outline"
          :disabled="!selected.length"
          @click="openAssign"
        >
          {{ t("cod_assegni.recon.assign.button") }}
        </v-btn>
      </template>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3">
      {{ error }}
    </v-alert>

    <v-data-table-server
      :headers="headers"
      :items="rows"
      :items-length="total"
      :loading="loading"
      :items-per-page="perPage"
      :items-per-page-options="[10, 25, 50, 100]"
      :page="page"
      :no-data-text="t('cod_assegni.recon.empty')"
      item-value="id"
      hover
      @update:page="onPage"
      @update:items-per-page="onPerPage"
    >
      <template v-if="tab === 'to_report' && caps.canWrite" #[`header.id`]>
        <v-checkbox-btn
          :model-value="allOnPage"
          :aria-label="t('cod_assegni.recon.select_page')"
          @update:model-value="
            (v: boolean | null) =>
              (selected = setPageSelection(selected, pageIds, !!v))
          "
        />
      </template>
      <template #[`item.id`]="{ item }">
        <div class="d-flex align-center">
          <v-checkbox-btn
            v-if="tab === 'to_report' && caps.canWrite"
            :model-value="selected.includes(item.id)"
            @update:model-value="selected = toggleSelection(selected, item.id)"
          />
          <span>{{ item.id }}</span>
        </div>
      </template>
      <template #[`item.contras_imp`]="{ item }">{{ money(item.contras_imp) }}</template>
      <template #[`item.contras_incasso`]="{ item }">
        <v-chip size="small" label variant="tonal">{{ t(stateLabelKey(item.contras_incasso)) }}</v-chip>
      </template>
      <template #[`item.actions`]="{ item }">
        <v-btn
          v-if="tab === 'pending' && caps.canWrite"
          size="small"
          variant="tonal"
          color="primary"
          @click="openCollect(item)"
        >
          {{ t("cod_assegni.recon.collect.button") }}
        </v-btn>
      </template>
    </v-data-table-server>

    <!-- Marcar cobrado -->
    <v-dialog
      :model-value="collectTarget !== null && !collectConfirm"
      max-width="460"
      @update:model-value="(v: boolean) => !v && (collectTarget = null)"
    >
      <v-card v-if="collectTarget">
        <v-card-title class="text-subtitle-1">
          {{ t("cod_assegni.recon.collect.title", { id: collectTarget.id }) }}
        </v-card-title>
        <v-card-text>
          <div class="text-body-2 mb-3">
            {{ collectTarget.AWB_forn }} · {{ money(collectTarget.contras_imp) }}
          </div>
          <v-text-field
            v-model="collectDate"
            type="date"
            :label="t('cod_assegni.recon.collect.date')"
            density="comfortable"
            variant="outlined"
          />
          <v-select
            v-model="collectState"
            :items="stateItems"
            :label="t('cod_assegni.recon.collect.method')"
            density="comfortable"
            variant="outlined"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="collectTarget = null">{{ t("cod_assegni.recon.cancel") }}</v-btn>
          <v-btn color="primary" :disabled="!collectDate" @click="collectConfirm = true">
            {{ t("cod_assegni.recon.collect.submit") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <ConfirmDialog
      v-model="collectConfirm"
      :title="t('cod_assegni.recon.collect.confirm_title')"
      :body="t('cod_assegni.recon.collect.confirm_body', { id: collectTarget?.id ?? '', date: collectDate })"
      :confirm-label="t('cod_assegni.recon.collect.submit')"
      :cancel-label="t('cod_assegni.recon.cancel')"
      confirm-color="primary"
      :loading="saving"
      @confirm="doCollect"
    />

    <!-- Asignar a remesa -->
    <v-dialog v-model="assignOpen" max-width="460">
      <v-card>
        <v-card-title class="text-subtitle-1">{{ t("cod_assegni.recon.assign.title") }}</v-card-title>
        <v-card-text>
          <div class="text-body-2 mb-3">
            {{ t("cod_assegni.recon.selected", { count: selected.length, amount: money(selTotal) }) }}
          </div>
          <v-text-field
            v-model="reportId"
            type="number"
            min="1"
            :label="t('cod_assegni.recon.assign.report_id')"
            density="comfortable"
            variant="outlined"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="assignOpen = false">{{ t("cod_assegni.recon.cancel") }}</v-btn>
          <v-btn color="primary" :disabled="!isValidReportId(reportId)" @click="assignConfirm = true">
            {{ t("cod_assegni.recon.assign.submit") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <ConfirmDialog
      v-model="assignConfirm"
      :title="t('cod_assegni.recon.assign.confirm_title')"
      :body="t('cod_assegni.recon.assign.confirm_body', { count: selected.length, report: reportId })"
      :confirm-label="t('cod_assegni.recon.assign.submit')"
      :cancel-label="t('cod_assegni.recon.cancel')"
      confirm-color="primary"
      :loading="saving"
      @confirm="doAssign"
    />

    <!-- Exportar -->
    <v-dialog v-model="exportOpen" max-width="460">
      <v-card>
        <v-card-title class="text-subtitle-1">{{ t("cod_assegni.recon.export.title") }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="exportFrom"
            type="date"
            :label="t('cod_assegni.recon.filter.from')"
            density="comfortable"
            variant="outlined"
          />
          <v-text-field
            v-model="exportTo"
            type="date"
            :label="t('cod_assegni.recon.filter.to')"
            density="comfortable"
            variant="outlined"
          />
          <v-btn-toggle v-model="exportFormat" mandatory density="comfortable" color="primary">
            <v-btn value="xlsx">XLSX</v-btn>
            <v-btn value="csv">CSV</v-btn>
          </v-btn-toggle>
          <v-alert v-if="exportError" type="error" variant="tonal" density="compact" class="mt-3">
            {{ exportError }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="exportOpen = false">{{ t("cod_assegni.recon.cancel") }}</v-btn>
          <v-btn
            color="primary"
            :loading="exporting"
            :disabled="!exportFrom || !exportTo"
            @click="doExport"
          >
            {{ t("cod_assegni.recon.export.submit") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
