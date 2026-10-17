<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { driverService } from "../services/driver.service";
import type { Driver, DriverRoute, Manifest } from "../types";

const { t } = useI18n();

const date = ref(new Date().toISOString().slice(0, 10));
const drivers = ref<Driver[]>([]);
const selectedDriver = ref<number | null>(null);
const route = ref<DriverRoute | null>(null);
const manifest = ref<Manifest | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function loadDrivers(): Promise<void> {
  error.value = null;
  route.value = null;
  manifest.value = null;
  selectedDriver.value = null;
  try {
    const res = await driverService.driversForDate(date.value);
    drivers.value = res.drivers;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  }
}

async function loadRoute(): Promise<void> {
  if (!selectedDriver.value) return;
  loading.value = true;
  error.value = null;
  try {
    route.value = await driverService.buildRoute(
      selectedDriver.value,
      date.value,
    );
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  } finally {
    loading.value = false;
  }
}

async function loadManifest(): Promise<void> {
  if (!selectedDriver.value) return;
  loading.value = true;
  try {
    manifest.value = await driverService.manifest(
      selectedDriver.value,
      date.value,
    );
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  } finally {
    loading.value = false;
  }
}

onMounted(loadDrivers);
</script>

<template>
  <div class="pk-page">
    <header class="pk-page-head">
      <h1 class="pk-page-title">{{ t("pickup.routes.title") }}</h1>
      <div class="d-flex ga-3 align-center">
        <v-text-field
          v-model="date"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 170px"
          @update:model-value="loadDrivers"
        />
        <v-select
          v-model="selectedDriver"
          :items="drivers"
          item-title="nome"
          item-value="id"
          :label="t('pickup.routes.driver')"
          density="compact"
          variant="outlined"
          hide-details
          style="min-width: 200px"
          @update:model-value="loadRoute"
        />
      </div>
    </header>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ error }}
    </v-alert>
    <v-progress-linear v-if="loading" indeterminate class="mb-3" />

    <div v-if="!selectedDriver" class="pk-empty">
      {{ t("pickup.routes.pick_driver") }}
    </div>

    <template v-else-if="route">
      <div class="d-flex justify-space-between align-center mb-3">
        <span class="text-medium-emphasis">{{
          t("pickup.routes.stops", { n: route.total })
        }}</span>
        <v-btn
          size="small"
          variant="tonal"
          prepend-icon="mdi-file-document-outline"
          @click="loadManifest"
        >
          {{ t("pickup.routes.manifest") }}
        </v-btn>
      </div>

      <ol class="pk-stops">
        <li v-for="stop in route.stops" :key="stop.pickup_id" class="pk-stop">
          <div class="pk-stop-order">{{ stop.order }}</div>
          <div class="pk-stop-body">
            <div class="pk-stop-cliente">{{ stop.cliente.ragsoc }}</div>
            <div class="pk-stop-addr">
              {{ stop.sede.indirizzo }}, {{ stop.sede.cap }}
              {{ stop.sede.citta }} ({{ stop.sede.prov }})
            </div>
            <div class="pk-stop-meta">
              <span>{{
                (stop.pickup_datetime.split(" ")[1] || "").slice(0, 5)
              }}</span>
              <span v-if="stop.n_colli"
                >· {{ stop.n_colli }} {{ t("pickup.routes.colli") }}</span
              >
              <span v-if="stop.peso">· {{ stop.peso }} kg</span>
              <v-chip
                v-if="stop.presa_fissa === 'S'"
                size="x-small"
                color="info"
                >{{ t("pickup.list.fixed") }}</v-chip
              >
              <v-chip
                v-if="stop.affidata === 'S'"
                size="x-small"
                color="success"
                >{{ t("pickup.list.yes") }}</v-chip
              >
            </div>
          </div>
        </li>
      </ol>

      <!-- Manifiesto -->
      <v-card v-if="manifest" variant="outlined" class="mt-6">
        <v-card-title class="text-subtitle-1">
          {{ t("pickup.routes.manifest") }} — {{ manifest.driver.nome }}
        </v-card-title>
        <v-card-text>
          <div class="pk-manifest-sum">
            <span
              >{{ t("pickup.routes.total_stops") }}:
              <b>{{ manifest.summary.total_stops }}</b></span
            >
            <span
              >{{ t("pickup.routes.total_colli") }}:
              <b>{{ manifest.summary.total_colli }}</b></span
            >
            <span
              >{{ t("pickup.routes.total_peso") }}:
              <b>{{ manifest.summary.total_peso }} kg</b></span
            >
          </div>
        </v-card-text>
      </v-card>
    </template>
  </div>
</template>

<style scoped>
.pk-page {
  padding: 24px;
  max-width: 900px;
}
.pk-page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 16px;
  flex-wrap: wrap;
}
.pk-page-title {
  font-size: 1.5rem;
  font-weight: 600;
}
.pk-empty {
  padding: 40px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.5);
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 8px;
}
.pk-stops {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pk-stop {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
}
.pk-stop-order {
  flex: 0 0 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
}
.pk-stop-cliente {
  font-weight: 600;
}
.pk-stop-addr {
  font-size: 0.85rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.pk-stop-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 0.8rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 4px;
}
.pk-manifest-sum {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}
</style>
