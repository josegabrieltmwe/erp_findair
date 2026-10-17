<template>
  <div>
    <div class="d-flex align-center mb-4">
      <div>
        <h2 class="text-h6">{{ t("tracking.tracking.title") }}</h2>
        <div class="text-caption text-medium-emphasis">{{ emailSummary }}</div>
      </div>
      <v-spacer />
      <v-btn
        color="primary"
        :prepend-icon="mdiPlayCircle"
        :loading="batchRunning"
        @click="openBatch"
      >
        {{ t("tracking.tracking.launch") }}
      </v-btn>
    </div>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div class="d-flex align-center flex-wrap ga-3">
        <v-select
          v-model="filterCourier"
          :items="courierItems"
          :label="t('tracking.tracking.filter_courier')"
          density="compact"
          hide-details
          clearable
          style="max-width: 200px"
          @update:model-value="onFilterChange"
        />
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('tracking.tracking.search')"
          density="compact"
          hide-details
          clearable
          style="max-width: 280px"
          @update:model-value="onSearch"
        />
        <v-spacer />
        <v-btn :icon="mdiRefresh" variant="text" size="small" @click="reload" />
      </div>
    </v-card>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="error = null"
    >
      {{ error }}
    </v-alert>

    <v-card variant="outlined">
      <v-table density="compact" hover>
        <thead>
          <tr>
            <th style="width: 60px">{{ t("tracking.tracking.col_id") }}</th>
            <th>{{ t("tracking.tracking.col_awb") }}</th>
            <th style="width: 90px">
              {{ t("tracking.tracking.col_courier") }}
            </th>
            <th>{{ t("tracking.tracking.col_client") }}</th>
            <th>{{ t("tracking.tracking.col_courier_date") }}</th>
            <th>{{ t("tracking.tracking.col_status") }}</th>
            <th>{{ t("tracking.tracking.col_delivery") }}</th>
            <th class="text-right" style="width: 90px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" class="text-center py-6">
              <v-progress-circular indeterminate color="primary" size="28" />
            </td>
          </tr>
          <tr v-else-if="shipments.length === 0">
            <td colspan="8" class="text-center py-8 text-medium-emphasis">
              {{ t("tracking.tracking.empty") }}
            </td>
          </tr>
          <tr v-for="s in shipments" v-else :key="s.id">
            <td class="text-medium-emphasis">{{ s.id }}</td>
            <td class="font-monospace">{{ s.AWB_forn }}</td>
            <td>
              <v-chip
                size="x-small"
                :color="courierColor(s.courier)"
                variant="flat"
              >
                {{ (s.courier || "").toUpperCase() }}
              </v-chip>
            </td>
            <td class="text-medium-emphasis">{{ s.cliente }}</td>
            <td class="text-medium-emphasis">{{ s.data_corriere }}</td>
            <td>
              <v-chip
                size="x-small"
                :color="statusColor(s.stato_tipo)"
                variant="tonal"
              >
                {{ s.stato_descr || "—" }}
              </v-chip>
            </td>
            <td class="text-medium-emphasis">{{ formatDeliveryDate(s.consegna_data) }}</td>
            <td class="text-right">
              <v-btn
                size="small"
                variant="text"
                :prepend-icon="mdiRadar"
                :loading="singleTrackingId === s.id"
                @click="trackSingle(s)"
              >
                {{ t("tracking.tracking.track") }}
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <div v-if="pages > 1" class="d-flex justify-center mt-4">
      <v-pagination
        :model-value="currentPage"
        :length="pages"
        density="compact"
        :total-visible="7"
        @update:model-value="goPage"
      />
    </div>

    <!-- Batch launch dialog: courier multi-select + progress -->
    <v-dialog v-model="batchDialog" max-width="560" :persistent="batchRunning">
      <v-card>
        <v-card-title>{{ t("tracking.tracking.batch_title") }}</v-card-title>
        <v-card-text>
          <template v-if="!batchRunning && !batchDone">
            <div class="text-body-2 mb-3">
              {{ t("tracking.tracking.batch_pick_couriers") }}
            </div>
            <v-select
              v-model="selectedCouriers"
              :items="courierItems"
              :label="t('tracking.tracking.batch_couriers_label')"
              multiple
              chips
              closable-chips
              density="comfortable"
              hide-details
              class="mb-2"
            />
            <div class="text-caption text-medium-emphasis">
              {{
                selectedCouriers.length
                  ? t("tracking.tracking.batch_selected_hint")
                  : t("tracking.tracking.batch_all_hint")
              }}
            </div>
          </template>

          <template v-else-if="batchRunning">
            <div class="text-center py-4">
              <v-progress-linear
                :model-value="
                  batchTotal > 0 ? (batchProcessed / batchTotal) * 100 : 0
                "
                :indeterminate="batchTotal === 0"
                color="primary"
                height="10"
                rounded
                class="mb-3"
              />
              <div class="text-body-2">
                {{
                  batchTotal > 0
                    ? t("tracking.tracking.batch_progress", {
                        done: batchProcessed,
                        total: batchTotal,
                      })
                    : t("tracking.tracking.batch_starting")
                }}
              </div>
              <div
                v-if="batchErrors > 0"
                class="text-caption text-warning mt-1"
              >
                {{ t("tracking.tracking.batch_errors", { n: batchErrors }) }}
              </div>
            </div>
          </template>

          <v-alert v-else type="success" variant="tonal">
            {{
              t("tracking.tracking.batch_finished", {
                done: batchProcessed,
                errors: batchErrors,
              })
            }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            v-if="!batchRunning && !batchDone"
            variant="text"
            @click="batchDialog = false"
          >
            {{ t("common.cancel") }}
          </v-btn>
          <v-btn
            v-if="!batchRunning && !batchDone"
            color="primary"
            variant="flat"
            @click="startBatch"
          >
            {{
              selectedCouriers.length
                ? t("tracking.tracking.launch_selected")
                : t("tracking.tracking.launch_all")
            }}
          </v-btn>
          <v-btn v-if="batchDone" variant="text" @click="closeBatch">{{
            t("common.close")
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { mdiPlayCircle, mdiMagnify, mdiRefresh, mdiRadar } from "@mdi/js";
import {
  trackingManagementService,
  type TrackingShipment,
  type EmailStats,
} from "../services/trackingManagement.service";

const { t } = useI18n();

const loading = ref(false);
const error = ref<string | null>(null);
const shipments = ref<TrackingShipment[]>([]);
const total = ref(0);
const couriers = ref<string[]>([]);
const emailStats = ref<EmailStats>({ total: 0, sent: 0, queued: 0, failed: 0 });

const filterCourier = ref<string>("");
const search = ref("");
const limit = ref(50);
const offset = ref(0);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const singleTrackingId = ref<number | null>(null);

// Batch (background job) state
const batchDialog = ref(false);
const batchRunning = ref(false);
const batchDone = ref(false);
const selectedCouriers = ref<string[]>([]);
const batchProcessed = ref(0);
const batchTotal = ref(0);
const batchErrors = ref(0);
let pollTimer: ReturnType<typeof setTimeout> | undefined;

const pages = computed(() => Math.ceil(total.value / limit.value) || 1);
const currentPage = computed(() => Math.floor(offset.value / limit.value) + 1);
const courierItems = computed(() =>
  couriers.value.map((c) => ({ title: c.toUpperCase(), value: c })),
);
const emailSummary = computed(() =>
  t("tracking.tracking.email_summary", {
    total: emailStats.value.total,
    sent: emailStats.value.sent,
    queued: emailStats.value.queued,
    failed: emailStats.value.failed,
  }),
);

function courierColor(courier?: string): string {
  const map: Record<string, string> = {
    dhl: "amber",
    ups: "brown",
    fedex: "purple",
    tnt: "orange",
    brt: "blue",
    mytnt: "teal",
  };
  return map[(courier || "").toLowerCase()] || "grey";
}
function statusColor(tipo?: string | null): string {
  const map: Record<string, string> = { D: "success", T: "info", P: "warning" };
  return map[tipo || ""] || "grey";
}

/**
 * `consegna_data` llega como la fecha "cero" de MySQL ('0000-00-00 00:00:00')
 * cuando el envío aún no fue entregado -- es un valor legítimo (no un bug de
 * datos, ver model/spedizioni/Spedizioni.php::find_pending_tracking(), que
 * filtra explícitamente por esta lista pendiente), pero es un string no
 * vacío y por tanto truthy: `s.consegna_data || "—"` nunca caía al
 * placeholder. Mismo criterio que is_real_date() del backend
 * (service/tracking/Public_Tracking_Service.php).
 */
function formatDeliveryDate(value?: string | null): string {
  if (!value || value.startsWith("0000-00-00")) return "—";
  return value;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const res = await trackingManagementService.list({
      limit: limit.value,
      offset: offset.value,
      courier: filterCourier.value || undefined,
      search: search.value || undefined,
    });
    shipments.value = res.shipments;
    total.value = res.total;
    couriers.value = res.couriers;
    emailStats.value = res.emailStats;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function reload(): void {
  void load();
}
function onFilterChange(): void {
  offset.value = 0;
  void load();
}
function onSearch(): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    offset.value = 0;
    void load();
  }, 400);
}
function goPage(page: number): void {
  offset.value = (page - 1) * limit.value;
  void load();
}

async function trackSingle(s: TrackingShipment): Promise<void> {
  singleTrackingId.value = s.id;
  try {
    const r = await trackingManagementService.trackSingle(s.id);
    if ((r.processed ?? 0) > 0) {
      await load();
    } else {
      error.value = t("tracking.tracking.single_no_update", { id: s.id });
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    singleTrackingId.value = null;
  }
}

function openBatch(): void {
  selectedCouriers.value = filterCourier.value ? [filterCourier.value] : [];
  batchProcessed.value = 0;
  batchTotal.value = 0;
  batchErrors.value = 0;
  batchDone.value = false;
  batchRunning.value = false;
  batchDialog.value = true;
}

async function startBatch(): Promise<void> {
  batchRunning.value = true;
  batchDone.value = false;
  batchProcessed.value = 0;
  batchTotal.value = 0;
  batchErrors.value = 0;
  try {
    const { jobId } = await trackingManagementService.runBatch(
      selectedCouriers.value,
    );
    pollJob(jobId);
  } catch (e) {
    batchRunning.value = false;
    error.value = e instanceof Error ? e.message : String(e);
    batchDialog.value = false;
  }
}

function pollJob(jobId: number): void {
  const tick = async (): Promise<void> => {
    try {
      const job = await trackingManagementService.pollJob(jobId);
      batchProcessed.value = job.progress_done;
      batchTotal.value = job.progress_total;
      batchErrors.value = job.errors;

      if (job.status === "done" || job.status === "failed") {
        batchRunning.value = false;
        batchDone.value = true;
        if (job.status === "failed") {
          error.value = job.error_msg || t("tracking.tracking.batch_failed");
        }
        await load();
        return;
      }
    } catch {
      // transient poll error — keep polling, the job may still be queued
    }
    pollTimer = setTimeout(() => {
      void tick();
    }, 2000);
  };
  void tick();
}

function closeBatch(): void {
  batchDialog.value = false;
  batchDone.value = false;
}

onMounted(() => {
  void load();
});
onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer);
  if (searchTimer) clearTimeout(searchTimer);
});
</script>
