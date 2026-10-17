<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useConfirmStore } from "@shared/anagrafiche/stores/confirm.store";
import { driverService } from "../services/driver.service";
import type { DriverZone, Province } from "../types";

const { t } = useI18n();
const confirm = useConfirmStore();

const provinces = ref<Province[]>([]);
const selectedProvincia = ref<string | null>(null);
const zones = ref<DriverZone[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// alta rápida
const newCap = ref("");
const newContatto = ref<number | null>(null);
const adding = ref(false);

async function loadProvinces(): Promise<void> {
  try {
    provinces.value = await driverService.provinces();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  }
}

async function loadZones(): Promise<void> {
  if (!selectedProvincia.value) return;
  loading.value = true;
  error.value = null;
  try {
    const res = await driverService.zonesByProvincia(selectedProvincia.value);
    zones.value = res.zones;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  } finally {
    loading.value = false;
  }
}

async function addZone(): Promise<void> {
  if (!newCap.value || !newContatto.value) return;
  adding.value = true;
  error.value = null;
  try {
    await driverService.assignZone(newCap.value, newContatto.value);
    newCap.value = "";
    newContatto.value = null;
    await loadZones();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action");
  } finally {
    adding.value = false;
  }
}

async function removeZone(zone: DriverZone): Promise<void> {
  const ok = await confirm.ask({
    title: t("pickup.zones.delete_title"),
    message: t("pickup.zones.delete_msg", { cap: zone.cap }),
  });
  if (!ok) return;
  try {
    await driverService.clearZone(zone.cap);
    await loadZones();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action");
  }
}

onMounted(loadProvinces);
</script>

<template>
  <div class="pk-page">
    <header class="pk-page-head">
      <h1 class="pk-page-title">{{ t("pickup.zones.title") }}</h1>
      <v-select
        v-model="selectedProvincia"
        :items="provinces"
        item-title="id_provincia"
        item-value="id_provincia"
        :label="t('pickup.zones.provincia')"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 200px"
        @update:model-value="loadZones"
      />
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

    <div class="pk-add-zone mb-4">
      <v-text-field
        v-model="newCap"
        :label="t('pickup.zones.cap')"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 140px"
      />
      <v-text-field
        v-model.number="newContatto"
        :label="t('pickup.zones.autista')"
        :hint="t('pickup.zones.autista_hint')"
        type="number"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 160px"
      />
      <v-btn
        color="primary"
        variant="tonal"
        :loading="adding"
        :disabled="!newCap || !newContatto"
        @click="addZone"
      >
        {{ t("pickup.zones.add") }}
      </v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate class="mb-3" />

    <div v-if="!selectedProvincia" class="pk-empty">
      {{ t("pickup.zones.pick_provincia") }}
    </div>
    <div v-else-if="zones.length === 0 && !loading" class="pk-empty">
      {{ t("pickup.zones.empty") }}
    </div>

    <v-table v-else density="compact" class="pk-table">
      <thead>
        <tr>
          <th>{{ t("pickup.zones.cap") }}</th>
          <th>{{ t("pickup.zones.autista") }}</th>
          <th style="width: 60px"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="z in zones" :key="z.id">
          <td>{{ z.cap }}</td>
          <td>{{ z.nome_autista || `#${z.id_contatto}` }}</td>
          <td>
            <v-btn
              icon="mdi-delete"
              size="x-small"
              variant="text"
              color="error"
              @click="removeZone(z)"
            />
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<style scoped>
.pk-page {
  padding: 24px;
  max-width: 700px;
}
.pk-page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.pk-page-title {
  font-size: 1.5rem;
  font-weight: 600;
}
.pk-add-zone {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.pk-empty {
  padding: 40px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.5);
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 8px;
}
.pk-table {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
}
</style>
