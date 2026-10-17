<template>
  <DashboardShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
    <template #topbar-title>
      <div class="d-flex align-center ga-2">
        <v-icon icon="mdi-scale-balance" size="24" color="primary" />
        <span class="text-h6">{{ t("invoicing.fiscal.title") }}</span>
        <v-chip
          v-if="store.meta && !store.canWrite"
          size="small"
          variant="tonal"
          prepend-icon="mdi-eye-outline"
        >
          {{ t("invoicing.fiscal.read_only") }}
        </v-chip>
      </div>
    </template>

    <template #sidebar="{ collapsed }">
      <OperationsNav :collapsed="collapsed" />
      <button
        type="button"
        class="sidebar-action"
        :class="{ 'sidebar-action--rail': collapsed }"
        :title="t('invoicing.invoice.list')"
        @click="router.push({ name: 'invoicing-list' })"
      >
        <v-icon icon="mdi-receipt-text" size="16" />
        <span v-if="!collapsed" class="sidebar-action-label">{{
          t("invoicing.invoice.list")
        }}</span>
      </button>
      <button
        type="button"
        class="sidebar-action"
        :class="{ 'sidebar-action--rail': collapsed }"
        :title="t('invoicing.envios.title')"
        @click="router.push({ name: 'invoicing-envios' })"
      >
        <v-icon icon="mdi-bank-transfer-out" size="16" />
        <span v-if="!collapsed" class="sidebar-action-label">{{
          t("invoicing.envios.title")
        }}</span>
      </button>
    </template>

    <div class="pa-4">
      <v-alert type="info" variant="tonal" density="compact" class="mb-3">
        {{ t("invoicing.fiscal.intro") }}
      </v-alert>
      <v-alert
        v-if="store.error"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-3"
      >
        {{ store.error }}
      </v-alert>

      <!-- Áreas (propuesta 1): qué cobramos, qué exige cada país, cómo y cuándo se envía, control. -->
      <v-tabs
        :model-value="area"
        color="primary"
        density="comfortable"
        class="mb-1"
        show-arrows
        @update:model-value="(v: unknown) => setArea(String(v))"
      >
        <v-tab v-for="ar in areas" :key="ar.value" :value="ar.value">
          <v-icon :icon="ar.icon" size="18" class="mr-1" />
          {{ t(`invoicing.fiscal.areas.${ar.value}`) }}
          <v-chip
            v-if="ar.value === 'control' && alertCount > 0"
            size="x-small"
            color="error"
            variant="flat"
            class="ml-2"
          >
            {{ alertCount }}
          </v-chip>
        </v-tab>
      </v-tabs>
      <p class="text-caption text-medium-emphasis mb-2">
        {{ t(`invoicing.fiscal.areas_ayuda.${area}`) }}
      </p>
      <v-chip-group
        v-if="areaTabs.length > 1"
        :model-value="tab"
        mandatory
        selected-class="text-primary"
        class="mb-3"
        @update:model-value="(v: unknown) => setTab(String(v))"
      >
        <v-chip
          v-for="tb in areaTabs"
          :key="tb.value"
          :value="tb.value"
          variant="outlined"
          filter
        >
          <v-icon :icon="tb.icon" size="16" class="mr-1" />
          {{ t(`invoicing.fiscal.tabs.${tb.value}`) }}
          <span
            v-if="tb.value === 'alertas' && alertCount > 0"
            class="ml-1 text-error"
            >({{ alertCount }})</span
          >
        </v-chip>
      </v-chip-group>

      <template v-if="store.meta">
        <v-window v-model="tab">
          <v-window-item value="panorama">
            <PanoramaPanel v-if="visited.has('panorama')" />
          </v-window-item>

          <v-window-item value="conceptos">
            <RuleTable
              tabla="valori"
              :title="t('invoicing.fiscal.tabla.valori')"
              timeline
              :filter-keys="['voce', 'iso_paese', 'partner']"
            />
            <v-expansion-panels class="mt-4" variant="accordion">
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon icon="mdi-format-list-bulleted-type" class="mr-2" />
                  {{ t("invoicing.fiscal.tabla.voci") }}
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <RuleTable
                    tabla="voci"
                    :filter-keys="['tipo']"
                    @changed="store.load(true)"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-window-item>

          <v-window-item value="parametros">
            <RuleTable
              tabla="parametri"
              :title="t('invoicing.fiscal.tabla.parametri')"
              timeline
              :filter-keys="['iso_paese', 'partner']"
            />
          </v-window-item>

          <v-window-item value="requisitos">
            <RuleTable
              tabla="requisiti"
              :title="t('invoicing.fiscal.tabla.requisiti')"
              :filter-keys="['iso_paese', 'partner', 'documento', 'fuente']"
            />
            <v-divider class="my-4" />
            <RuleTable
              tabla="chiavi"
              :title="t('invoicing.fiscal.tabla.chiavi')"
              :filter-keys="['ambito']"
            />
          </v-window-item>

          <v-window-item value="canales">
            <RuleTable
              tabla="canali"
              :title="t('invoicing.fiscal.tabla.canali')"
              timeline
              :filter-keys="['iso_paese', 'partner', 'tipo']"
            />
            <v-divider class="my-4" />
            <IntermediariTable @changed="store.load(true)" />
          </v-window-item>

          <v-window-item value="plazos">
            <RuleTable
              tabla="plazos"
              :title="t('invoicing.fiscal.tabla.plazos')"
              timeline
              :filter-keys="['iso_paese', 'partner', 'caso']"
            />
          </v-window-item>

          <v-window-item value="reglas">
            <ReglasPorEtapaPanel v-if="visited.has('reglas')" />
          </v-window-item>

          <v-window-item value="revision">
            <RevisionPanel v-if="visited.has('revision')" />
          </v-window-item>

          <v-window-item value="alertas">
            <AlertasPanel @count="alertCount = $event" />
          </v-window-item>
        </v-window>
      </template>
      <v-progress-linear v-else-if="store.loading" indeterminate />
    </div>
  </DashboardShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import DashboardShell from "@shared/listing/DashboardShell.vue";
import OperationsNav from "@shared/platform/OperationsNav.vue";
import AlertasPanel from "../components/fiscal/AlertasPanel.vue";
import IntermediariTable from "../components/fiscal/IntermediariTable.vue";
import PanoramaPanel from "../components/fiscal/PanoramaPanel.vue";
import ReglasPorEtapaPanel from "../components/fiscal/ReglasPorEtapaPanel.vue";
import RevisionPanel from "../components/fiscal/RevisionPanel.vue";
import RuleTable from "../components/fiscal/RuleTable.vue";
import { useFiscConfigStore } from "../stores/fiscConfig.store";

/**
 * «Configuración fiscal» (DISENO §3.2): reglas con vigencia que mantienen los
 * operadores de TMWE (R-4). Áreas (informe para dirección, propuesta 1):
 *   Por partner  semáforo y ficha por partner y país (propuestas 2 y 3)
 *   Qué cobramos  Conceptos y valores, Reglas (asistente, vista previa, conflictos)
 *   Qué exige cada país  Requisitos (y claves), Parámetros
 *   Cómo y cuándo se envía  Canales e intermediarios, Plazos
 *   Control  Revisión, Alertas
 * La pestaña va en `?tab=` para poder enlazarla; el área se deduce de ella.
 */
const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const store = useFiscConfigStore();

const tabs = [
  { value: "panorama", icon: "mdi-traffic-light-outline", area: "panorama" },
  { value: "conceptos", icon: "mdi-percent-outline", area: "cobramos" },
  { value: "reglas", icon: "mdi-sitemap-outline", area: "cobramos" },
  { value: "requisitos", icon: "mdi-clipboard-check-outline", area: "exige" },
  { value: "parametros", icon: "mdi-tune-variant", area: "exige" },
  { value: "canales", icon: "mdi-transit-connection-variant", area: "envio" },
  { value: "plazos", icon: "mdi-timer-sand", area: "envio" },
  { value: "revision", icon: "mdi-magnify-scan", area: "control" },
  { value: "alertas", icon: "mdi-bell-outline", area: "control" },
];

const areas = [
  { value: "panorama", icon: "mdi-traffic-light-outline" },
  { value: "cobramos", icon: "mdi-cash-multiple" },
  { value: "exige", icon: "mdi-clipboard-check-outline" },
  { value: "envio", icon: "mdi-send-clock-outline" },
  { value: "control", icon: "mdi-shield-search" },
];

const initial = String(route.query.tab ?? "panorama");
const tab = ref(tabs.some((x) => x.value === initial) ? initial : "panorama");
const visited = reactive(new Set<string>([tab.value]));
const alertCount = ref(0);

const area = computed(
  () => tabs.find((x) => x.value === tab.value)?.area ?? "panorama",
);
const areaTabs = computed(() => tabs.filter((x) => x.area === area.value));

function setTab(next: string): void {
  tab.value = next;
  visited.add(next);
  void router.replace({ query: { ...route.query, tab: next } });
}

/** Cambiar de área abre su primera pestaña. */
function setArea(next: string): void {
  const first = tabs.find((x) => x.area === next);
  if (first && first.area !== area.value) setTab(first.value);
}

onMounted(() => {
  void store.load();
});
</script>

<style scoped>
.sidebar-action {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.85rem;
  text-align: left;
}

.sidebar-action:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.sidebar-action--rail {
  justify-content: center;
  padding: 8px;
}

.sidebar-action-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
