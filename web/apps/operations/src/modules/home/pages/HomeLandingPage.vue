<template>
  <!--
    Inicio (landing tras el login). Deliberadamente SIN datos: no consulta KPIs
    ni indicadores, solo pinta accesos. Los indicadores del día viven en
    /home/activities (botón "Actividades del día"), que los calcula al abrirse.

    Los accesos salen del MISMO catálogo que el menú lateral (navCatalog) y se
    filtran con el mismo rol, así que home y menú no pueden divergir.
  -->
  <div class="home-landing" data-testid="home-landing">
    <header class="home-landing__head">
      <div>
        <h1 class="home-landing__title">{{ t('home.landing.title') }}</h1>
        <p class="home-landing__sub">{{ t('home.landing.subtitle') }}</p>
      </div>
    </header>

    <div class="home-landing__primary">
      <v-btn
        size="x-large"
        color="primary"
        variant="flat"
        prepend-icon="mdi-clipboard-check-outline"
        class="home-landing__activities"
        data-testid="home-activities-btn"
        :to="{ name: 'home-activities' }"
      >
        {{ t('home.landing.activities_button') }}
      </v-btn>
      <span class="home-landing__hint">{{ t('home.landing.activities_hint') }}</span>
    </div>

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
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { NAV_SECTION_DEFS, visibleNavSections } from '@shared/platform/navCatalog';
import { useNavRole } from '@shared/platform/useNavRole';

const { t } = useI18n();
const { isAdmin, load } = useNavRole();

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
.home-landing__title { font-size: 1.5rem; font-weight: 600; line-height: 1.2; margin: 0; }
.home-landing__sub { margin: 4px 0 0; opacity: 0.7; }
.home-landing__primary { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.home-landing__hint { opacity: 0.7; font-size: 0.9rem; }
.home-landing__section { display: flex; flex-direction: column; gap: 10px; }
.home-landing__label { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.65; margin: 0; }
.home-landing__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.home-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; text-decoration: none; }
.home-card__icon { flex: none; }
.home-card__text { display: flex; flex-direction: column; min-width: 0; }
.home-card__title { font-weight: 600; }
.home-card__sub { font-size: 0.8rem; opacity: 0.7; }
</style>
