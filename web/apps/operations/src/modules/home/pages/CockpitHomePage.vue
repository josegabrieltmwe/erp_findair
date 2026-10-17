<template>
  <div class="cockpit-home" data-testid="home-activities">
    <div class="cockpit-home__bar">
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-arrow-left"
        data-testid="home-activities-back"
        :to="{ name: 'home' }"
      >
        {{ t('home.landing.back') }}
      </v-btn>
      <h1 class="cockpit-home__title">{{ t('home.landing.activities_title') }}</h1>
      <v-spacer />
      <span v-if="updatedText" class="cockpit-home__updated" data-testid="home-activities-updated">{{ updatedText }}</span>
      <v-btn
        variant="tonal"
        size="small"
        prepend-icon="mdi-refresh"
        data-testid="home-activities-refresh"
        @click="page?.reload()"
      >
        {{ t('home.landing.refresh') }}
      </v-btn>
    </div>
    <HomePage ref="page" :categories="categories" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import HomePage from "@shared/dashboard/HomePage.vue";
import type { KpiCategory } from "@shared/dashboard/home_kpi_catalog";

const { t, locale } = useI18n();
const page = ref<InstanceType<typeof HomePage> | null>(null);

// "Actualizado a las HH:MM": hora del dato más antiguo de la carga (el servidor
// sirve de su caché; "Actualizar" fuerza el recálculo).
const updatedText = computed(() => {
  const ts = page.value?.updatedAt;
  if (!ts) return "";
  const time = new Date(ts).toLocaleTimeString(String(locale.value), { hour: "2-digit", minute: "2-digit" });
  return t("home.landing.updated_at", { time });
});

// Vista "Actividades del día": aquí SÍ se calculan los indicadores, al abrirla.
// La home (/home) no consulta nada.
const categories: KpiCategory[] = [
  "cargo_lifecycle",
  "cargo_in_transit",
  "courier_ops_in",
  "courier_ops_out",
  "assist",
  "warehouse",
  "commercial_leads",
  "tracking_indicators",
];
</script>

<style scoped lang="scss">
.cockpit-home { display: flex; flex-direction: column; gap: 12px; width: 100%; padding: 16px 20px 64px; }
.cockpit-home__bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.cockpit-home__title { font-size: 1.25rem; font-weight: 600; margin: 0; }
.cockpit-home__updated { font-size: 0.8rem; opacity: 0.7; }
</style>
