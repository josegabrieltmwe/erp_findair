<script setup lang="ts">
import { todayLocal } from "@shared/utils/date";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { pickupsService } from "../services/pickups.service";
import CalendarGrid from "../components/CalendarGrid.vue";
import CalendarPeriodGrid from "../components/CalendarPeriodGrid.vue";
import DriverAssignDialog from "../components/DriverAssignDialog.vue";
import {
  buildPeriodCells,
  calendarRange,
  rangeCovers,
  shiftReference,
  type CalendarView,
  type DateRange,
} from "../logic";
import type { CalendarResult, Driver, Pickup } from "../types";

const { t } = useI18n();

const date = ref(todayLocal());
const view = ref<CalendarView>("day");
const driverId = ref<number | null>(null);
const drivers = ref<Driver[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<CalendarResult | null>(null);
/** Rango y autista del último GET: si cubre la vista pedida no se vuelve a pedir. */
const loaded = ref<(DateRange & { driver: number | null }) | null>(null);

const assignOpen = ref(false);
const selectedPickup = ref<Pickup | null>(null);

const range = computed(() => calendarRange(view.value, date.value));

const dayPickups = computed<Pickup[]>(() => {
  const day = result.value?.calendar.find((d) => d.date.startsWith(date.value));
  return day?.pickups ?? [];
});

const cells = computed(() =>
  view.value === "day"
    ? []
    : buildPeriodCells(view.value, date.value, result.value?.calendar ?? []),
);

const title = computed(() => {
  const r = range.value;
  if (view.value === "day") return date.value;
  if (view.value === "month") return date.value.slice(0, 7);
  return `${r.from} — ${r.to}`;
});

async function load(force = false): Promise<void> {
  const want = range.value;
  if (
    !force &&
    loaded.value?.driver === driverId.value &&
    rangeCovers(loaded.value, want)
  ) {
    return; // cambio de vista dentro de lo ya cargado: sin petición
  }
  loading.value = true;
  error.value = null;
  try {
    result.value = await pickupsService.calendar(
      want.from,
      want.to,
      driverId.value ?? undefined,
    );
    loaded.value = { ...want, driver: driverId.value };
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  } finally {
    loading.value = false;
  }
}

async function loadDrivers(): Promise<void> {
  try {
    drivers.value = await pickupsService.availableDrivers(date.value);
  } catch {
    drivers.value = []; // sin lista el filtro de autista no se ofrece
  }
}

function shift(delta: number): void {
  date.value = shiftReference(view.value, date.value, delta);
  void load();
}

function setView(v: CalendarView | null): void {
  if (!v) return;
  view.value = v;
  void load();
}

function openDay(d: string): void {
  date.value = d;
  view.value = "day";
  void load();
}

function onPick(p: Pickup): void {
  selectedPickup.value = p;
  assignOpen.value = true;
}

onMounted(() => {
  void load();
  void loadDrivers();
});
</script>

<template>
  <div class="pk-page">
    <header class="pk-page-head">
      <h1 class="pk-page-title">{{ t("pickup.calendar.title") }}</h1>
      <div class="pk-day-nav">
        <v-btn-toggle
          :model-value="view"
          mandatory
          density="compact"
          variant="outlined"
          divided
          @update:model-value="setView"
        >
          <v-btn value="day" size="small">{{ t("pickup.calendar.view_day") }}</v-btn>
          <v-btn value="week" size="small">{{ t("pickup.calendar.view_week") }}</v-btn>
          <v-btn value="month" size="small">{{ t("pickup.calendar.view_month") }}</v-btn>
        </v-btn-toggle>
        <v-select
          v-if="drivers.length"
          v-model="driverId"
          :items="[{ nome: t('pickup.calendar.all_drivers'), id: null }, ...drivers]"
          item-title="nome"
          item-value="id"
          :label="t('pickup.calendar.driver')"
          density="compact"
          variant="outlined"
          hide-details
          style="min-width: 180px"
          @update:model-value="load(true)"
        />
        <v-btn
          icon="mdi-chevron-left"
          size="small"
          variant="text"
          @click="shift(-1)"
        />
        <v-text-field
          v-if="view === 'day'"
          v-model="date"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 180px"
          @update:model-value="load()"
        />
        <span v-else class="pk-period">{{ title }}</span>
        <v-btn
          icon="mdi-chevron-right"
          size="small"
          variant="text"
          @click="shift(1)"
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

    <template v-if="view === 'day'">
      <div v-if="!loading && dayPickups.length === 0" class="pk-empty">
        {{ t("pickup.calendar.empty") }}
      </div>
      <CalendarGrid v-else :pickups="dayPickups" @pick="onPick" />
    </template>
    <CalendarPeriodGrid
      v-else
      :cells="cells"
      :view="view"
      @day="openDay"
      @pick="onPick"
    />

    <div class="pk-legend">
      <span class="pk-legend-item"
        ><i class="dot dot--pk" /> {{ t("pickup.calendar.leg_normal") }}</span
      >
      <span class="pk-legend-item"
        ><i class="dot dot--fixed" /> {{ t("pickup.calendar.leg_fixed") }}</span
      >
      <span class="pk-legend-item"
        ><i class="dot dot--ship" /> {{ t("pickup.calendar.leg_shipment") }}</span
      >
      <span class="pk-legend-item"
        ><i class="dot dot--tri" /> {{ t("pickup.calendar.leg_triangulation") }}</span
      >
      <span class="pk-legend-item"
        ><i class="dot dot--done" /> {{ t("pickup.calendar.leg_done") }}</span
      >
    </div>

    <DriverAssignDialog
      v-model="assignOpen"
      :pickup="selectedPickup"
      :date="date"
      @changed="load(true)"
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
  flex-wrap: wrap;
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
.pk-period {
  min-width: 190px;
  text-align: center;
  font-weight: 600;
}
.pk-legend {
  display: flex;
  flex-wrap: wrap;
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
.dot--ship {
  background: rgba(var(--v-theme-secondary), 0.5);
}
.dot--tri {
  background: rgba(var(--v-theme-warning), 0.55);
}
.dot--done {
  background: rgba(var(--v-theme-success), 0.5);
}
</style>
