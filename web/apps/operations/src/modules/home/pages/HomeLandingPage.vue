<template>
  <!--
    Inicio minimalista: una sola pregunta, «¿qué quieres hacer?».
      1. Buscador (lleva al listado ya filtrado).
      2. Dos acciones primarias: nuevo cargo y nueva expedición.
      3. «Requiere tu atención»: máx. 5 avisos con valor > 0 (2 peticiones).
    El menú lateral es la navegación; ya no se repite aquí. El cuadro de mando
    completo vive en /home/indicators y solo se carga si se visita.
    Todo lo de arriba se pinta sin esperar datos; los avisos llegan después.
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

    <section class="home-landing__attention" data-testid="home-attention" :aria-busy="loading">
      <h2 class="home-landing__label">{{ t('home.landing.attention_title') }}</h2>

      <ul v-if="loading" class="home-attention__list" data-testid="home-attention-loading">
        <li v-for="n in 3" :key="n" class="home-attention__skeleton" />
      </ul>

      <p v-else-if="failed" class="home-landing__muted" data-testid="home-attention-error">
        {{ t('home.landing.attention_error') }}
        <v-btn variant="text" size="small" @click="load(true)">{{ t('common.retry') }}</v-btn>
      </p>

      <p v-else-if="items.length === 0" class="home-landing__muted" data-testid="home-attention-empty">
        <v-icon icon="mdi-check-circle-outline" size="18" color="success" class="mr-1" />
        {{ t('home.landing.attention_empty') }}
      </p>

      <ul v-else class="home-attention__list">
        <li v-for="it in items" :key="it.kpi.key">
          <button
            type="button"
            class="home-attention__row"
            :class="`home-attention__row--${it.kpi.variant ?? 'default'}`"
            :data-testid="`home-attention-${it.kpi.key}`"
            @click="open(it)"
          >
            <span class="home-attention__count">{{ it.count }}</span>
            <span class="home-attention__label">{{ kpiLabel(t, it.kpi) }}</span>
            <v-icon icon="mdi-arrow-right" size="18" />
          </button>
        </li>
      </ul>

      <router-link :to="{ name: 'home-indicators' }" class="home-landing__more" data-testid="home-indicators-link">
        {{ t('home.landing.all_indicators') }}
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useCockpitStore } from '@shared/dashboard/cockpit.store';
import { kpiLabel } from '@shared/dashboard/home_kpi_catalog';
import { ATTENTION_CATEGORIES, ATTENTION_KEYS, pickAttention, type AttentionItem } from '../attention';

const { t } = useI18n();
const router = useRouter();
const BASE_PATH = '/bff/v1';

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

// ── Avisos: store del cockpit (stale-while-revalidate, no bloquea el router) ──
const cockpit = useCockpitStore();
const { counts, pending, errors } = storeToRefs(cockpit);

const hasAllData = computed(() => ATTENTION_KEYS.every((k) => counts.value[k] !== undefined));
const loading = computed(() => !hasAllData.value && pending.value.size > 0);
const failed = computed(() => !hasAllData.value && !loading.value && Object.keys(errors.value).length > 0);
const items = computed<AttentionItem[]>(() => pickAttention(counts.value));

function load(force = false): void {
  if (force) cockpit.forceRefresh(ATTENTION_CATEGORIES, BASE_PATH);
  else cockpit.ensureCategories(ATTENTION_CATEGORIES, BASE_PATH);
}

function open(it: AttentionItem): void {
  void router.push({ name: it.kpi.link.page, query: it.kpi.link.query });
}

onMounted(() => load());
</script>

<style scoped lang="scss">
.home-landing { display: flex; flex-direction: column; gap: 32px; width: 100%; max-width: 760px; margin: 0 auto; padding: 40px 20px 64px; }
.home-landing__hero { display: flex; flex-direction: column; gap: 16px; }
.home-landing__title { font-size: 1.6rem; font-weight: 600; margin: 0; }
.home-landing__search { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.home-landing__search :deep(.v-text-field) { flex: 1 1 280px; }
.home-landing__create { display: flex; flex-wrap: wrap; gap: 8px; }
.home-landing__attention { display: flex; flex-direction: column; gap: 10px; }
.home-landing__label { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.65; margin: 0; }
.home-landing__muted { margin: 0; opacity: 0.75; display: flex; align-items: center; }
.home-landing__more { align-self: flex-start; font-size: 0.85rem; }
.home-attention__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.home-attention__skeleton { height: 44px; border-radius: 6px; background: rgba(var(--v-theme-on-surface), 0.06); }
.home-attention__row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 14px; border: 1px solid rgba(var(--v-theme-on-surface), 0.14); border-left-width: 4px; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; text-align: left; font: inherit; }
.home-attention__row:hover { background: rgba(var(--v-theme-on-surface), 0.04); }
.home-attention__row--error { border-left-color: rgb(var(--v-theme-error)); }
.home-attention__row--warning { border-left-color: rgb(var(--v-theme-warning)); }
.home-attention__row--default,
.home-attention__row--success { border-left-color: rgb(var(--v-theme-primary)); }
.home-attention__count { font-weight: 700; min-width: 2ch; }
.home-attention__label { flex: 1; }
</style>
