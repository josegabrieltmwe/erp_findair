<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { operationsService } from "../services/operations.service";
import type { OperationsOverview } from "../types";

const { t } = useI18n();

const today = new Date().toISOString().slice(0, 10);
const date = ref(today);
const loading = ref(true);
const error = ref<string | null>(null);
const overview = ref<OperationsOverview | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    overview.value = await operationsService.overview(date.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="pk-page">
    <header class="pk-page-head">
      <h1 class="pk-page-title">{{ t("pickup.operations.title") }}</h1>
      <v-text-field
        v-model="date"
        type="date"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 200px"
        @update:model-value="load"
      />
    </header>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      {{ error }}
    </v-alert>

    <v-progress-linear v-if="loading" indeterminate class="mb-4" />

    <template v-if="overview">
      <!-- Prese -->
      <h2 class="pk-section-title">{{ t("pickup.operations.pickups") }}</h2>
      <div class="pk-stat-grid mb-6">
        <div class="pk-stat">
          <span class="pk-stat-num">{{ overview.pickups.total }}</span>
          <span class="pk-stat-lbl">{{ t("pickup.operations.total") }}</span>
        </div>
        <div class="pk-stat pk-stat--ok">
          <span class="pk-stat-num">{{ overview.pickups.assigned }}</span>
          <span class="pk-stat-lbl">{{ t("pickup.operations.assigned") }}</span>
        </div>
        <div class="pk-stat pk-stat--warn">
          <span class="pk-stat-num">{{ overview.pickups.unassigned }}</span>
          <span class="pk-stat-lbl">{{
            t("pickup.operations.unassigned")
          }}</span>
        </div>
        <div class="pk-stat">
          <span class="pk-stat-num">{{ overview.pickups.fixed }}</span>
          <span class="pk-stat-lbl">{{ t("pickup.operations.fixed") }}</span>
        </div>
        <div class="pk-stat pk-stat--ok">
          <span class="pk-stat-num">{{ overview.pickups.completed }}</span>
          <span class="pk-stat-lbl">{{
            t("pickup.operations.completed")
          }}</span>
        </div>
      </div>

      <!-- Giacenze -->
      <h2 class="pk-section-title">{{ t("pickup.operations.giacenze") }}</h2>
      <div class="pk-stat-grid mb-6">
        <div class="pk-stat">
          <span class="pk-stat-num">{{ overview.giacenze.total_open }}</span>
          <span class="pk-stat-lbl">{{ t("pickup.operations.open") }}</span>
        </div>
        <div class="pk-stat">
          <span class="pk-stat-num">{{ overview.giacenze.new_today }}</span>
          <span class="pk-stat-lbl">{{
            t("pickup.operations.new_today")
          }}</span>
        </div>
        <div class="pk-stat pk-stat--warn">
          <span class="pk-stat-num">{{ overview.giacenze.overdue }}</span>
          <span class="pk-stat-lbl">{{ t("pickup.operations.overdue") }}</span>
        </div>
        <div class="pk-stat">
          <span class="pk-stat-num">{{
            overview.giacenze.awaiting_client
          }}</span>
          <span class="pk-stat-lbl">{{ t("pickup.operations.awaiting") }}</span>
        </div>
      </div>

      <!-- Entregas -->
      <h2 class="pk-section-title">{{ t("pickup.operations.deliveries") }}</h2>
      <div class="pk-stat-grid">
        <div class="pk-stat">
          <span class="pk-stat-num">{{ overview.deliveries.pending }}</span>
          <span class="pk-stat-lbl">{{ t("pickup.operations.pending") }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pk-page {
  padding: 24px;
  max-width: 1100px;
}
.pk-page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 16px;
}
.pk-page-title {
  font-size: 1.5rem;
  font-weight: 600;
}
.pk-section-title {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(var(--v-theme-on-surface), 0.55);
  margin-bottom: 10px;
}
.pk-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.pk-stat {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.pk-stat--ok {
  background: rgba(var(--v-theme-success), 0.08);
}
.pk-stat--warn {
  background: rgba(var(--v-theme-warning), 0.1);
}
.pk-stat-num {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
}
.pk-stat-lbl {
  font-size: 0.8rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 4px;
}
</style>
