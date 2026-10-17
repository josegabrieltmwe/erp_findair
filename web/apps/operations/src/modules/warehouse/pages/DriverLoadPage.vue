<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ApiError } from "@tmwe/shared-frontend/http";
import { can } from "../env";
import {
  alreadyLoaded,
  createScanGuard,
  driverCounters,
  todayIso,
} from "../logic";
import { errMsg } from "../print";
import { warehouseApi } from "../services/warehouse.service";
import { useToastStore } from "../stores/toast.store";
import type { DriverLoading, DriverRef } from "../types";
import type { Manifest } from "../../pickup/types";

const { t } = useI18n();
const toast = useToastStore();
const canWrite = can.write();

const date = ref(todayIso());
const drivers = ref<DriverRef[]>([]);
const driverId = ref<number | null>(null);
const loading = ref<DriverLoading | null>(null);
const code = ref("");
const scanInput = ref<{ focus: () => void } | null>(null);
const guard = createScanGuard();
const busy = ref(false);
const confirmReset = ref(false);
const manifest = ref<Manifest | null>(null);
const manifestOpen = ref(false);

const counters = computed(() => driverCounters(loading.value?.parcels ?? []));

function focusScan(): void {
  void nextTick(() => scanInput.value?.focus());
}

async function loadDrivers(): Promise<void> {
  driverId.value = null;
  loading.value = null;
  try {
    drivers.value = await warehouseApi.driversForDate(date.value);
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.load_failed")));
  }
}

async function refresh(): Promise<void> {
  if (!driverId.value) return;
  try {
    loading.value = await warehouseApi.driverLoading(driverId.value, date.value);
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.load_failed")));
  }
}

async function pickDriver(): Promise<void> {
  await refresh();
  focusScan();
}

async function scan(): Promise<void> {
  const c = guard.accept(code.value);
  code.value = "";
  if (!c || !driverId.value || !canWrite) return;
  busy.value = true;
  try {
    const r = await warehouseApi.lookup(c);
    if (!r.found || r.source !== "spedizioni_colli" || !r.parcel) {
      toast.push("warning", t("warehouse.driver.not_found", { code: c }));
      return;
    }
    if (alreadyLoaded(loading.value?.parcels ?? [], Number(r.parcel.id))) {
      toast.push("info", t("warehouse.driver.already", { code: c }));
      return;
    }
    await warehouseApi.assignDriver([Number(r.parcel.id)], driverId.value);
    await refresh();
    toast.push("success", t("warehouse.driver.loaded", { code: c }), 1500);
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.save_failed")));
  } finally {
    busy.value = false;
    focusScan();
  }
}

async function doReset(): Promise<void> {
  if (!driverId.value) return;
  busy.value = true;
  try {
    await warehouseApi.clearDriverLoading(driverId.value, date.value);
    confirmReset.value = false;
    await refresh();
    toast.push("success", t("warehouse.driver.reset_done"));
  } catch (e) {
    toast.push("error", errMsg(e, t("warehouse.common.save_failed")));
  } finally {
    busy.value = false;
    focusScan();
  }
}

async function openManifest(): Promise<void> {
  if (!driverId.value) return;
  try {
    manifest.value = await warehouseApi.driverManifest(driverId.value, date.value);
    manifestOpen.value = true;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      toast.push("info", t("warehouse.driver.manifest_none"));
    } else if (e instanceof ApiError && e.status === 403) {
      toast.push("warning", t("warehouse.driver.manifest_forbidden"));
    } else {
      toast.push("error", errMsg(e, t("warehouse.common.load_failed")));
    }
  }
}

function printPage(): void {
  window.print();
}

const driverName = computed(
  () => drivers.value.find((d) => d.id === driverId.value)?.nome ?? "",
);

onMounted(loadDrivers);
</script>

<template>
  <div class="wh-page">
    <h1 class="text-h6 mb-4">{{ t("warehouse.driver.title") }}</h1>
    <v-alert v-if="!canWrite" type="info" variant="tonal" density="compact" class="mb-3">
      {{ t("warehouse.common.read_only") }}
    </v-alert>

    <div class="d-flex flex-wrap ga-3 mb-4">
      <v-text-field
        v-model="date"
        type="date"
        :label="t('warehouse.common.date')"
        variant="outlined"
        density="compact"
        hide-details
        style="max-width: 180px"
        @update:model-value="loadDrivers"
      />
      <v-select
        v-model="driverId"
        :items="drivers"
        item-title="nome"
        item-value="id"
        :label="t('warehouse.driver.driver')"
        variant="outlined"
        density="compact"
        hide-details
        style="min-width: 240px"
        @update:model-value="pickDriver"
      />
    </div>
    <div v-if="!drivers.length" class="text-caption text-medium-emphasis mb-3">
      {{ t("warehouse.driver.no_drivers") }}
    </div>

    <template v-if="driverId">
      <v-text-field
        ref="scanInput"
        v-model="code"
        :label="t('warehouse.weighing.marker')"
        :hint="t('warehouse.driver.scan_hint')"
        persistent-hint
        autofocus
        variant="outlined"
        prepend-inner-icon="mdi-barcode-scan"
        :loading="busy"
        :disabled="!canWrite"
        class="mb-3"
        @keyup.enter="scan"
      />

      <div class="d-flex flex-wrap ga-3 mb-3">
        <v-card variant="tonal" color="primary" class="pa-3 text-center wh-count">
          <div class="text-h5">{{ counters.parcels }}</div>
          <div class="text-caption">{{ t("warehouse.driver.parcels") }}</div>
        </v-card>
        <v-card variant="tonal" color="primary" class="pa-3 text-center wh-count">
          <div class="text-h5">{{ counters.shipments }}</div>
          <div class="text-caption">{{ t("warehouse.driver.shipments") }}</div>
        </v-card>
        <v-card variant="tonal" class="pa-3 text-center wh-count">
          <div class="text-h5">{{ counters.totalKg }}</div>
          <div class="text-caption">kg</div>
        </v-card>
      </div>

      <div class="d-flex flex-wrap ga-2 mb-3">
        <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="refresh">{{
          t("warehouse.docpack.reload")
        }}</v-btn>
        <v-btn
          variant="tonal"
          color="error"
          prepend-icon="mdi-delete-sweep-outline"
          :disabled="!canWrite || !counters.parcels"
          @click="confirmReset = true"
          >{{ t("warehouse.driver.reset") }}</v-btn
        >
        <v-btn variant="tonal" prepend-icon="mdi-printer" @click="openManifest">{{
          t("warehouse.driver.manifest")
        }}</v-btn>
      </div>

      <v-table v-if="loading?.parcels?.length" density="compact">
        <thead>
          <tr>
            <th>{{ t("warehouse.docpack.shipment") }}</th>
            <th>{{ t("warehouse.weighing.marker") }}</th>
            <th>kg</th>
            <th>{{ t("warehouse.driver.waybill") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in loading.parcels" :key="p.id">
            <td>#{{ p.id_spedizione }}</td>
            <td>{{ p.segnac_cliente || p.AWB_forn || p.n_collo }}</td>
            <td>{{ p.peso }}</td>
            <td>
              <v-icon
                :icon="p.ldv_stampata === 'S' ? 'mdi-check-circle' : 'mdi-circle-outline'"
                :color="p.ldv_stampata === 'S' ? 'success' : undefined"
                size="18"
              />
            </td>
          </tr>
        </tbody>
      </v-table>
      <div v-else class="text-medium-emphasis">{{ t("warehouse.driver.empty") }}</div>
    </template>

    <v-dialog v-model="confirmReset" max-width="440">
      <v-card :title="t('warehouse.driver.reset')">
        <v-card-text>{{
          t("warehouse.driver.reset_confirm", { driver: driverName, n: counters.parcels })
        }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="confirmReset = false">{{ t("warehouse.common.cancel") }}</v-btn>
          <v-btn color="error" variant="flat" :loading="busy" @click="doReset">{{
            t("warehouse.driver.reset_yes")
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="manifestOpen" max-width="860" scrollable>
      <v-card v-if="manifest">
        <v-card-text class="wh-print">
          <h2 class="text-h6">{{ t("warehouse.driver.manifest_title") }}</h2>
          <div class="mb-3">
            {{ manifest.driver?.nome }} · {{ manifest.date }} ·
            {{ t("warehouse.driver.stops", { n: manifest.summary?.total_stops ?? 0 }) }}
          </div>
          <table class="wh-print-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{{ t("warehouse.driver.customer") }}</th>
                <th>{{ t("warehouse.driver.address") }}</th>
                <th>{{ t("warehouse.driver.parcels") }}</th>
                <th>kg</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in manifest.stops" :key="s.pickup_id">
                <td>{{ s.order }}</td>
                <td>{{ s.cliente?.ragsoc }}</td>
                <td>{{ s.sede?.indirizzo }}, {{ s.sede?.cap }} {{ s.sede?.citta }}</td>
                <td>{{ s.n_colli }}</td>
                <td>{{ s.peso }}</td>
              </tr>
            </tbody>
          </table>
          <h3 class="text-subtitle-1 mt-4">
            {{ t("warehouse.driver.loaded_parcels", { n: counters.parcels }) }}
          </h3>
          <table class="wh-print-table">
            <tbody>
              <tr v-for="p in loading?.parcels ?? []" :key="p.id">
                <td>#{{ p.id_spedizione }}</td>
                <td>{{ p.segnac_cliente || p.AWB_forn || p.n_collo }}</td>
                <td>{{ p.peso }} kg</td>
              </tr>
            </tbody>
          </table>
        </v-card-text>
        <v-card-actions class="wh-noprint">
          <v-spacer />
          <v-btn @click="manifestOpen = false">{{ t("warehouse.common.close") }}</v-btn>
          <v-btn color="primary" variant="flat" prepend-icon="mdi-printer" @click="printPage">{{
            t("warehouse.driver.print")
          }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.wh-page {
  padding: 24px;
  max-width: 880px;
}
.wh-count {
  min-width: 110px;
}
</style>

<style>
.wh-print-table {
  width: 100%;
  border-collapse: collapse;
}
.wh-print-table th,
.wh-print-table td {
  border-bottom: 1px solid #ccc;
  padding: 4px 6px;
  text-align: left;
  font-size: 0.85rem;
}
@media print {
  body * {
    visibility: hidden;
  }
  .wh-print,
  .wh-print * {
    visibility: visible;
  }
  .wh-print {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }
  .wh-noprint {
    display: none !important;
  }
}
</style>
