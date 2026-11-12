<script setup lang="ts">
import { todayLocal } from "@shared/utils/date";
import { computed, onMounted, ref } from "vue";
import { useProfile } from "@shared/composables/useProfile";
import { useI18n } from "vue-i18n";
import { operationsService } from "../services/operations.service";
import type {
  GiacenzaAlert,
  OperationsDriverRow,
  OperationsOverview,
} from "../types";

/** Umbral (días) de las alertas de almacenaje. */
const ALERT_THRESHOLD = 15;

const { t } = useI18n();

const today = todayLocal();
const date = ref(today);
const loading = ref(true);
const error = ref<string | null>(null);
const overview = ref<OperationsOverview | null>(null);
const drivers = ref<OperationsDriverRow[]>([]);
const alerts = ref<GiacenzaAlert[]>([]);
const detailError = ref<string | null>(null);

const { isAdmin, ensureProfile } = useProfile();

/** `adminOnly`: el giro y las zonas exigen administrador (rutas `requiresAdmin`). */
const allLinks: Array<{ name: string; icon: string; key: string; adminOnly?: boolean }> = [
  { name: "pickup-list", icon: "mdi-format-list-bulleted", key: "list" },
  { name: "pickup-calendar", icon: "mdi-calendar-month-outline", key: "calendar" },
  { name: "pickup-routes", icon: "mdi-routes", key: "routes", adminOnly: true },
  { name: "pickup-pod", icon: "mdi-clipboard-check-outline", key: "pod" },
  { name: "settings-driver-zones", icon: "mdi-map-marker-radius-outline", key: "zones", adminOnly: true },
];
const links = computed(() =>
  allLinks.filter((l) => !l.adminOnly || isAdmin.value === true),
);

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
  // El detalle por autista y las alertas son secundarios: un fallo no tapa el resumen.
  detailError.value = null;
  const [byDriver, alertRows] = await Promise.allSettled([
    operationsService.byDriver(date.value),
    operationsService.alerts(ALERT_THRESHOLD),
  ]);
  drivers.value = byDriver.status === "fulfilled" ? byDriver.value : [];
  alerts.value = alertRows.status === "fulfilled" ? alertRows.value : [];
  if (byDriver.status === "rejected" || alertRows.status === "rejected") {
    detailError.value = t("errors.load");
  }
}

onMounted(() => {
  void ensureProfile();
  void load();
});
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

    <nav class="pk-links mb-4">
      <v-btn
        v-for="l in links"
        :key="l.key"
        :to="{ name: l.name }"
        :prepend-icon="l.icon"
        variant="tonal"
        size="small"
      >
        {{ t(`pickup.nav.${l.key}`) }}
      </v-btn>
    </nav>

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

      <v-alert
        v-if="detailError"
        type="warning"
        variant="tonal"
        density="compact"
        class="mt-6"
      >
        {{ detailError }}
      </v-alert>

      <!-- Prese por autista -->
      <h2 class="pk-section-title mt-6">{{ t("pickup.operations.by_driver") }}</h2>
      <v-table v-if="drivers.length" density="compact" class="pk-table">
        <thead>
          <tr>
            <th>{{ t("pickup.operations.driver") }}</th>
            <th class="text-end">{{ t("pickup.operations.pickups") }}</th>
            <th class="text-end">{{ t("pickup.routes.total_colli") }}</th>
            <th class="text-end">{{ t("pickup.routes.total_peso") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in drivers" :key="d.driver_id">
            <td>
              {{ d.driver_id ? d.driver_name : t("pickup.operations.unassigned") }}
            </td>
            <td class="text-end">{{ d.pickup_count }}</td>
            <td class="text-end">{{ d.total_colli }}</td>
            <td class="text-end">{{ d.total_peso }} kg</td>
          </tr>
        </tbody>
      </v-table>
      <div v-else class="pk-empty">{{ t("pickup.operations.no_drivers") }}</div>

      <!-- Alertas de almacenaje -->
      <h2 class="pk-section-title mt-6">
        {{ t("pickup.operations.alerts", { days: ALERT_THRESHOLD }) }}
      </h2>
      <v-table v-if="alerts.length" density="compact" class="pk-table">
        <thead>
          <tr>
            <th>{{ t("pickup.operations.alert_ldv") }}</th>
            <th>{{ t("pickup.operations.alert_dest") }}</th>
            <th>{{ t("pickup.operations.alert_since") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(a, i) in alerts" :key="a.id ?? i">
            <td>{{ a.ldv ?? a.id_spedizione ?? "—" }}</td>
            <td>{{ a.dest_nome || "—" }}</td>
            <td>{{ (a.data_open || "").slice(0, 10) || "—" }}</td>
          </tr>
        </tbody>
      </v-table>
      <div v-else class="pk-empty">{{ t("pickup.operations.no_alerts") }}</div>
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
.pk-links {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pk-table {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
}
.pk-empty {
  padding: 20px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.5);
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 8px;
}
</style>
