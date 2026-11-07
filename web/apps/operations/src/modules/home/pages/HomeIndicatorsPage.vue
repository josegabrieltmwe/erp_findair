<template>
  <!--
    Indicadores: el cuadro de mando completo (antes ocupaba la home). Solo se
    carga si se visita: la home ya no lanza estas peticiones.
  -->
  <div class="home-indicators" data-testid="home-indicators">
    <div class="home-indicators__bar">
      <h1 class="home-indicators__title">{{ t('home.indicators.title') }}</h1>
      <v-spacer />
      <span v-if="updatedText" class="home-indicators__updated" data-testid="home-activities-updated">{{ updatedText }}</span>
      <v-btn
        variant="tonal"
        size="small"
        prepend-icon="mdi-refresh"
        data-testid="home-activities-refresh"
        @click="dashboard?.reload()"
      >
        {{ t('home.landing.refresh') }}
      </v-btn>
    </div>
    <HomePage ref="dashboard" :categories="categories" :hide-zero="true" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import HomePage from '@shared/dashboard/HomePage.vue';
import type { KpiCategory } from '@shared/dashboard/home_kpi_catalog';

const { t, locale } = useI18n();
const dashboard = ref<InstanceType<typeof HomePage> | null>(null);

const categories: KpiCategory[] = [
  'cargo_lifecycle',
  'cargo_in_transit',
  'courier_ops_in',
  'courier_ops_out',
  'assist',
  'warehouse',
  'commercial_leads',
  'tracking_indicators',
];

const updatedText = computed(() => {
  const ts = dashboard.value?.updatedAt;
  if (!ts) return '';
  const time = new Date(ts).toLocaleTimeString(String(locale.value), { hour: '2-digit', minute: '2-digit' });
  return t('home.landing.updated_at', { time });
});
</script>

<style scoped lang="scss">
.home-indicators { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 1180px; margin: 0 auto; padding: 24px 20px 64px; }
.home-indicators__bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.home-indicators__title { font-size: 1.1rem; font-weight: 600; margin: 0; }
.home-indicators__updated { font-size: 0.8rem; opacity: 0.7; }
</style>
