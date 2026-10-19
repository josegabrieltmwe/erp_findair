<template>
  <!--
    Inicio (landing tras el login). Lleva el dashboard de KPIs ("Actividades
    del día", antes en /home/activities) arriba, y debajo las CTAs y los
    accesos del menú.

    El fetch de los KPIs (vía HomePage.vue → cockpit store) es no bloqueante:
    cola propia con máximo 3 peticiones en paralelo, cliente `ofetch` propio
    (no el `http` compartido de las SPAs) y nada en el router lo espera. Entrar
    a la app dispara esas peticiones en segundo plano, pero navegar a otra
    pantalla (buscar una expedición, abrir un cliente…) no espera ni un
    instante a que lleguen.

    Los accesos salen del MISMO catálogo que el menú lateral (navCatalog) y se
    filtran con el mismo rol, así que home y menú no pueden divergir.
  -->
  <div class="home-landing" data-testid="home-landing">
    <section class="home-landing__dashboard" data-testid="home-activities">
      <div class="home-landing__dashboard-bar">
        <h2 class="home-landing__label home-landing__label--inline">{{ t('home.landing.activities_title') }}</h2>
        <v-spacer />
        <span v-if="updatedText" class="home-landing__updated" data-testid="home-activities-updated">{{ updatedText }}</span>
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
    </section>

    <section class="home-landing__section" data-testid="home-create">
      <h2 class="home-landing__label">{{ t('home.landing.new_actions') }}</h2>
      <div class="home-landing__grid">
        <v-card
          v-for="cta in createActions"
          :key="cta.routeName"
          class="home-card"
          variant="outlined"
          :to="{ name: cta.routeName }"
          :data-testid="`home-cta-${cta.routeName}`"
        >
          <v-icon :icon="cta.icon" size="26" class="home-card__icon" />
          <div class="home-card__text">
            <span class="home-card__title">{{ t(cta.titleKey) }}</span>
            <span class="home-card__sub">{{ t(cta.subKey) }}</span>
          </div>
        </v-card>
      </div>
    </section>

    <section v-for="section in sections" :key="section.sectionKey" class="home-landing__section">
      <h2 class="home-landing__label">{{ t(`platform.opsnav.sections.${section.sectionKey}`) }}</h2>
      <div class="home-landing__grid">
        <v-card
          v-for="it in section.items"
          :key="it.key"
          class="home-card"
          variant="outlined"
          v-bind="it.routeName ? { to: { name: it.routeName } } : { href: it.href }"
          :data-testid="`home-link-${it.key}`"
        >
          <v-icon :icon="it.icon" size="22" class="home-card__icon" />
          <div class="home-card__text">
            <span class="home-card__title">{{ t(`platform.opsnav.${it.key}`) }}</span>
          </div>
        </v-card>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import HomePage from '@shared/dashboard/HomePage.vue';
import type { KpiCategory } from '@shared/dashboard/home_kpi_catalog';
import { NAV_SECTION_DEFS, visibleNavSections } from '@shared/platform/navCatalog';
import { useNavRole } from '@shared/platform/useNavRole';

const { t, locale } = useI18n();
const { isAdmin, load } = useNavRole();
const dashboard = ref<InstanceType<typeof HomePage> | null>(null);

// Mismos indicadores que antes pedía /home/activities.
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

// "Actualizado a las HH:MM": hora del dato más antiguo de la carga (el servidor
// sirve de su caché; "Actualizar" fuerza el recálculo).
const updatedText = computed(() => {
  const ts = dashboard.value?.updatedAt;
  if (!ts) return '';
  const time = new Date(ts).toLocaleTimeString(String(locale.value), { hour: '2-digit', minute: '2-digit' });
  return t('home.landing.updated_at', { time });
});

// Crear algo es lo que más se hace desde el inicio. Claves ya traducidas
// (home.home.cta.*) en los 5 idiomas del módulo.
const createActions = [
  { routeName: 'cargo-new', icon: 'mdi-airplane', titleKey: 'home.home.cta.new_cargo', subKey: 'home.home.cta.new_cargo_sub' },
  { routeName: 'shipment-new', icon: 'mdi-truck-fast-outline', titleKey: 'home.home.cta.new_shipment', subKey: 'home.home.cta.new_shipment_sub' },
];

// El menú lateral ya tiene "Inicio": aquí sobra. El resto, mismo orden y rol.
const sections = computed(() =>
  visibleNavSections(NAV_SECTION_DEFS, isAdmin.value)
    .map((s) => ({ ...s, items: s.items.filter((it) => it.key !== 'home') }))
    .filter((s) => s.items.length > 0),
);

onMounted(() => {
  void load();
});
</script>

<style scoped lang="scss">
.home-landing { display: flex; flex-direction: column; gap: 22px; width: 100%; max-width: 1180px; margin: 0 auto; padding: 24px 20px 64px; }
.home-landing__dashboard { display: flex; flex-direction: column; gap: 12px; }
.home-landing__dashboard-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.home-landing__updated { font-size: 0.8rem; opacity: 0.7; }
.home-landing__section { display: flex; flex-direction: column; gap: 10px; }
.home-landing__label { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.65; margin: 0; }
.home-landing__label--inline { font-size: 1rem; text-transform: none; letter-spacing: normal; opacity: 1; }
.home-landing__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.home-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; text-decoration: none; }
.home-card__icon { flex: none; }
.home-card__text { display: flex; flex-direction: column; min-width: 0; }
.home-card__title { font-weight: 600; }
.home-card__sub { font-size: 0.8rem; opacity: 0.7; }
</style>
