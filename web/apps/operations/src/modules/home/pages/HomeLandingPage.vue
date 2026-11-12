<template>
  <!--
    Inicio minimalista: una sola pregunta, «¿qué quieres hacer?».
      1. Buscador (lleva al listado ya filtrado).
      2. Dos acciones primarias: nuevo cargo y nueva expedición.
      3. «Da fare oggi» (TodayBoard): tarjetas con lo que espera una acción, cada una con su
         número y su enlace a la lista filtrada; las que valen 0 se ocultan.
    El menú lateral es la navegación; ya no se repite aquí. El cuadro de mando
    completo vive en /home/indicators y solo se carga si se visita.
    Todo lo de arriba se pinta sin esperar datos; los números llegan después.
  -->
  <div class="home-landing" data-testid="home-landing">
    <section class="home-landing__hero">
      <h1 class="home-landing__title">{{ t('home.landing.title') }}</h1>
      <form class="home-landing__search" role="search" data-testid="home-search" @submit.prevent="submitSearch">
        <v-text-field
          v-model="term"
          :placeholder="t('home.landing.search_placeholder')"
          :aria-label="t('home.landing.search_placeholder')"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="comfortable"
          hide-details
          clearable
          autofocus
          data-testid="home-search-input"
        />
        <v-btn-toggle v-model="target" mandatory density="comfortable" variant="outlined" divided class="home-landing__target">
          <v-btn value="shipment-list" data-testid="home-search-shipment">{{ t('home.landing.search_shipments') }}</v-btn>
          <v-btn value="cargo-list" data-testid="home-search-cargo">{{ t('home.landing.search_cargo') }}</v-btn>
        </v-btn-toggle>
        <v-btn type="submit" color="primary" data-testid="home-search-submit">{{ t('home.landing.search_button') }}</v-btn>
      </form>
      <div class="home-landing__create">
        <v-btn
          v-for="cta in createActions"
          :key="cta.routeName"
          color="primary"
          variant="flat"
          :prepend-icon="cta.icon"
          :to="{ name: cta.routeName }"
          :data-testid="`home-cta-${cta.routeName}`"
        >
          {{ t(cta.titleKey) }}
        </v-btn>
      </div>
    </section>

    <TodayBoard />

    <router-link :to="{ name: 'home-indicators' }" class="home-landing__more" data-testid="home-indicators-link">
      {{ t('home.landing.all_indicators') }}
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import TodayBoard from '@shared/dashboard/TodayBoard.vue';

const { t } = useI18n();
const router = useRouter();

const term = ref('');
const target = ref<'shipment-list' | 'cargo-list'>('shipment-list');

// Crear algo es lo que más se hace desde el inicio.
const createActions = [
  { routeName: 'cargo-new', icon: 'mdi-airplane', titleKey: 'home.home.cta.new_cargo' },
  { routeName: 'shipment-new', icon: 'mdi-truck-fast-outline', titleKey: 'home.home.cta.new_shipment' },
];

function submitSearch(): void {
  const search = (term.value ?? '').trim();
  void router.push({ name: target.value, query: search ? { search } : {} });
}
</script>

<style scoped lang="scss">
.home-landing { display: flex; flex-direction: column; gap: 32px; width: 100%; max-width: 1100px; margin: 0 auto; padding: 40px 20px 64px; }
.home-landing__hero { display: flex; flex-direction: column; gap: 16px; max-width: 760px; }
.home-landing__title { font-size: 1.6rem; font-weight: 600; margin: 0; }
.home-landing__search { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.home-landing__search :deep(.v-text-field) { flex: 1 1 280px; }
.home-landing__create { display: flex; flex-wrap: wrap; gap: 8px; }
.home-landing__more { align-self: flex-start; font-size: 0.85rem; }
</style>
