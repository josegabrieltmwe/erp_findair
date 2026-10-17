<script setup lang="ts">
/**
 * Export menu for the shipment listing — the modern replacement for the
 * legacy `sped_excel.php` popup in `sped_cerca.php`, which offered the same
 * six groupings behind `?vrs=`.
 *
 * Two scopes, mirroring what the user has in front of them:
 *  - a selection, when rows are ticked (exports exactly those ids);
 *  - otherwise the listing's own filters, forwarded verbatim, so the file
 *    matches the list on screen.
 *
 * The export runs as a background job (~34s for 5000 rows), so this enqueues
 * and polls rather than waiting on the request. The backend caps an export at
 * 5000 shipments and decides on its own whether the price columns are included
 * (authx_18 / authx_20).
 */
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  shipmentExportService,
  type ShipmentExportFormat,
  type ShipmentExportGrouping,
} from "@shipment/services/shipment_export.service";
// The shared store, not @shipment's re-export of it: this component is mounted
// from the cargo listing too, and must not drag a sibling module in.
import { useToastStore } from "@shared/stores/toast.store";

const props = defineProps<{
  /** Ticked rows. When non-empty the export covers just these. */
  selectedIds?: number[];
  /** The listing's current query params, forwarded to the backend as-is. */
  params?: Record<string, unknown>;
  /** Listing flavour — express or cargo. */
  type?: "express" | "cargo";
}>();

const { t } = useI18n();
const toasts = useToastStore();

const open = ref(false);
const busy = ref(false);
const format = ref<ShipmentExportFormat>("xlsx");
const grouping = ref<ShipmentExportGrouping>("0");

/** Poll handle, so an unmount cannot leave a timer running. */
let pollTimer: ReturnType<typeof setTimeout> | null = null;
onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer);
});

const selectionCount = computed(() => props.selectedIds?.length ?? 0);
const hasSelection = computed(() => selectionCount.value > 0);

const groupings = computed<{ value: ShipmentExportGrouping; label: string }[]>(
  () => [
    { value: "0", label: t("listing.export.grouping.flat") },
    { value: "S", label: t("listing.export.grouping.office") },
    { value: "C", label: t("listing.export.grouping.client") },
    { value: "R", label: t("listing.export.grouping.reference") },
    { value: "U", label: t("listing.export.grouping.user") },
    { value: "N", label: t("listing.export.grouping.country") },
  ],
);

const scopeLabel = computed(() =>
  hasSelection.value
    ? t("listing.export.scope_selection", { count: selectionCount.value })
    : t("listing.export.scope_filters"),
);

/**
 * Poll until the job leaves the queue.
 *
 * The drain cron runs every minute, so the first stretch can be a genuine
 * wait; polling every 2s keeps that responsive without hammering. The cap is
 * a safety net — a job that never finishes must not poll forever.
 */
function waitForJob(jobId: number): Promise<void> {
  const started = Date.now();
  const MAX_WAIT_MS = 10 * 60 * 1000;

  return new Promise((resolve, reject) => {
    const tick = async (): Promise<void> => {
      try {
        const job = await shipmentExportService.poll(jobId);

        if (job.status === "done") {
          const result = job.result;
          if (result?.empty || !result?.token) {
            reject(new Error(t("listing.export.empty")));
            return;
          }
          shipmentExportService.download(jobId);
          toasts.push(
            "success",
            t("listing.export.done", { count: result.row_count ?? 0 }),
          );
          if (result.truncated) {
            toasts.push(
              "warning",
              t("listing.export.truncated", { count: result.max_rows ?? 5000 }),
            );
          }
          resolve();
          return;
        }

        if (job.status === "failed") {
          reject(new Error(job.error_msg || t("listing.export.failed")));
          return;
        }

        if (Date.now() - started > MAX_WAIT_MS) {
          reject(new Error(t("listing.export.timeout")));
          return;
        }

        pollTimer = setTimeout(() => void tick(), 2000);
      } catch (err) {
        reject(err as Error);
      }
    };

    void tick();
  });
}

async function run(): Promise<void> {
  if (busy.value) return;
  busy.value = true;

  try {
    const jobId = await shipmentExportService.enqueue({
      type_export: props.type ?? "express",
      format: format.value,
      grouping: grouping.value,
      // A selection wins over the filters: it is the more explicit ask.
      ...(hasSelection.value
        ? { shipment_ids: props.selectedIds }
        : { params: props.params }),
    });

    open.value = false;
    toasts.push("info", t("listing.export.queued"));
    await waitForJob(jobId);
  } catch (err) {
    toasts.push("error", (err as Error).message || t("listing.export.failed"));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <v-menu v-model="open" :close-on-content-click="false" location="bottom end">
    <template #activator="{ props: menuProps }">
      <button
        type="button"
        class="topbar-iconbtn"
        :title="t('listing.export.title')"
        v-bind="menuProps"
      >
        <v-icon icon="mdi-file-excel-outline" size="18" />
      </button>
    </template>

    <div class="topbar-exportpop card-tmwe">
      <div class="export-title">{{ t("listing.export.title") }}</div>
      <div class="export-scope">{{ scopeLabel }}</div>

      <v-select
        v-model="grouping"
        :items="groupings"
        item-title="label"
        item-value="value"
        :label="t('listing.export.grouping.label')"
        density="compact"
        variant="outlined"
        hide-details
        class="mb-3"
      />

      <v-btn-toggle
        v-model="format"
        mandatory
        density="compact"
        variant="outlined"
        divided
        class="mb-3 export-format"
      >
        <v-btn value="xlsx" size="small">XLSX</v-btn>
        <v-btn value="csv" size="small">CSV</v-btn>
      </v-btn-toggle>

      <v-btn
        block
        color="primary"
        size="small"
        prepend-icon="mdi-download"
        :loading="busy"
        @click="run"
      >
        {{ t("listing.export.action") }}
      </v-btn>
    </div>
  </v-menu>
</template>

<style scoped>
.topbar-exportpop {
  width: 280px;
  padding: 14px;
}

.export-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 2px;
}

.export-scope {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-bottom: 12px;
}

.export-format {
  width: 100%;
}

.export-format :deep(.v-btn) {
  flex: 1;
}
</style>
