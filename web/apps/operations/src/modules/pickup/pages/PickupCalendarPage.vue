<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { pickupsService } from "../services/pickups.service";
import CalendarGrid from "../components/CalendarGrid.vue";
import DriverAssignDialog from "../components/DriverAssignDialog.vue";
import type { CalendarResult, Pickup } from "../types";

const { t } = useI18n();

const date = ref(new Date().toISOString().slice(0, 10));
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<CalendarResult | null>(null);

const assignOpen = ref(false);
const selectedPickup = ref<Pickup | null>(null);

// El calendario muestra un día; se pide un rango [date, date].
const dayPickups = computed<Pickup[]>(() => {
  const day = result.value?.calendar.find((d) => d.date.startsWith(date.value));
  return day?.pickups ?? [];
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    result.value = await pickupsService.calendar(date.value, date.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  } finally {
    loading.value = false;
  }
}

function shiftDay(delta: number): void {
  const d = new Date(date.value);
  d.setDate(d.getDate() + delta);
  date.value = d.toISOString().slice(0, 10);
  load();
}

function onPick(p: Pickup): void {
  selectedPickup.value = p;
  assignOpen.value = true;
}

onMounted(load);
</script>

<template>
  <div class="pk-page">
    <header class="pk-page-head">
      <h1 class="pk-page-title">{{ t("pickup.calendar.title") }}</h1>
      <div class="pk-day-nav">
        <v-btn
          icon="mdi-chevron-left"
          size="small"
          variant="text"
          @click="shiftDay(-1)"
        />
        <v-text-field
          v-model="date"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 180px"
          @update:model-value="load"
        />
        <v-btn
          icon="mdi-chevron-right"
          size="small"
          variant="text"
          @click="shiftDay(1)"
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

    <div v-if="!loading && dayPickups.length === 0" class="pk-empty">
      {{ t("pickup.calendar.empty") }}
    </div>
    <CalendarGrid v-else :pickups="dayPickups" @pick="onPick" />

    <div class="pk-legend">
      <span class="pk-legend-item"
        ><i class="dot dot--pk" /> {{ t("pickup.calendar.leg_normal") }}</span
      >
      <span class="pk-legend-item"
        ><i class="dot dot--fixed" /> {{ t("pickup.calendar.leg_fixed") }}</span
      >
      <span class="pk-legend-item"
        ><i class="dot dot--done" /> {{ t("pickup.calendar.leg_done") }}</span
      >
    </div>

    <DriverAssignDialog
      v-model="assignOpen"
      :pickup="selectedPickup"
      :date="date"
      @changed="load"
    />
  </div>
</template>

<style scoped>
.pk-page {
  padding: 24px;
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
.pk-day-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pk-empty {
  padding: 40px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.5);
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 8px;
}
.pk-legend {
  display: flex;
  gap: 20px;
  margin-top: 12px;
  font-size: 0.78rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.pk-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}
.dot--pk {
  background: rgba(var(--v-theme-primary), 0.4);
}
.dot--fixed {
  background: rgba(var(--v-theme-info), 0.5);
}
.dot--done {
  background: rgba(var(--v-theme-success), 0.5);
}
</style>
