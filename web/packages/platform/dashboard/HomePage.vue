<template>
  <!--
    Home dashboard — renders all KPI tiles for the active categories,
    organised into domain-aligned sections. The horizontal tabs choose
    the domain and the optional vertical rail filters its subgroups.

    Data flow: independent AJAX sources pass through a bounded queue. A
    failed source does not prevent the remaining sections from loading.
  -->
  <div class="home-page tmwe-cockpit">
    <v-alert v-if="error" type="error" density="compact" class="home-error" icon="mdi-alert-circle-outline">
      {{ error }}
      <template #append>
        <v-btn variant="text" size="small" @click="reload()">{{ t('common.retry') }}</v-btn>
      </template>
    </v-alert>

    <v-tabs v-model="activeSection" class="tmwe-cockpit__tabs" color="primary" show-arrows>
      <v-tab v-for="entry in sectionsForRender" :key="entry.section.id" :value="entry.section.id">
        <v-icon :icon="entry.section.icon" size="17" class="mr-2" />
        {{ kpiSectionTitle(t, entry.section) }}
      </v-tab>
    </v-tabs>

    <div class="tmwe-cockpit__flow">
      {{ activeSectionSpec ? kpiSectionFlow(t, activeSectionSpec) : '' }}
    </div>

    <section
      v-for="entry in sectionsForRender"
      :key="entry.section.id"
      v-show="activeSection === entry.section.id"
      :id="`home-section-${entry.section.id}`"
      class="home-section"
      :class="{
        'home-section--loading': isSectionLoading(entry),
      }"
    >
      <!-- Section ribbon: a 3px colored accent on the left edge that
           identifies the domain (express in / express out / cargo)
           at a glance even when the section is collapsed. -->
      <span class="home-section__ribbon" :data-section="entry.section.id" />

      <div class="home-section__header">
        <span class="home-section__icon-badge" :data-section="entry.section.id">
          <v-icon :icon="entry.section.icon" size="18" />
        </span>

        <span class="home-section__head">
          <span class="home-section__title">{{ kpiSectionTitle(t, entry.section) }}</span>
          <span class="home-section__sub">{{ sectionMeta(entry) }}</span>
        </span>

        <span class="home-section__spacer" />

        <!-- While the section's bucket(s) are still in flight we show
             a small spinner instead of the total — a partial total
             would jump as buckets land and confuse the operator. -->
        <span class="home-section__indicator">
          <v-progress-circular
            v-if="isSectionLoading(entry)"
            indeterminate
            size="18"
            width="2"
            color="primary"
            :aria-label="t('platform.dashboard.loading_section_aria')"
          />
          <span
            v-else
            class="home-section__total"
            :class="{ 'home-section__total--zero': sectionTotal(entry) === 0 }"
            >{{ sectionTotal(entry) }}</span
          >
        </span>

        <!-- Drill-into-list affordance. -->
        <span
          class="home-section__open"
          role="button"
          tabindex="0"
          :data-section="entry.section.id"
          :title="kpiSectionListLabel(t, entry.section)"
          :aria-label="kpiSectionListLabel(t, entry.section)"
          @click="openSectionList(entry.section)"
          @keydown.enter.prevent="openSectionList(entry.section)"
          @keydown.space.prevent="openSectionList(entry.section)"
        >
          <v-icon icon="mdi-arrow-top-right" size="16" />
        </span>
      </div>

      <!-- La carga no oculta la navegación: el rail y las cestas se
           mantienen visibles mientras llegan los contadores. -->
      <div v-if="isSectionLoading(entry)" class="home-section__loading">
        <v-progress-linear indeterminate color="primary" height="2" rounded />
        <div class="home-section__loading-hint">
          <v-icon icon="mdi-sync" size="14" class="home-section__loading-spin" />
          <span>{{
            t('platform.dashboard.loading_section', {
              section: kpiSectionTitle(t, entry.section).toLowerCase(),
            })
          }}</span>
        </div>
      </div>

      <div class="home-section__body tmwe-cockpit__body">
        <div v-if="entry.groups.length > 1" class="tmwe-cockpit__rail-wrap">
          <v-tabs
            v-model="activeGroups[entry.section.id]"
            direction="vertical"
            class="tmwe-cockpit__rail"
            color="primary"
          >
            <v-tab :value="ALL_GROUPS">{{ t('home.cockpit.all_groups') }}</v-tab>
            <v-tab v-for="group in entry.groups" :key="group.group" :value="group.group">
              {{ kpiGroupLabel(t, group.group) }}
            </v-tab>
          </v-tabs>
        </div>

        <div class="tmwe-cockpit__content">
          <template v-for="group in visibleGroups(entry)" :key="group.group">
            <HomeKpiGroup
              :title="kpiGroupLabel(t, group.group)"
              :total="groupTotal(group)"
              :loading="isSectionLoading(entry)"
            >
              <HomeKpiTile
                v-for="tile in group.tiles"
                :key="tile.key"
                :icon="tile.icon"
                :label="kpiLabel(t, tile)"
                :description="kpiDescription(t, tile) || undefined"
                :value="counts[tile.key] ?? null"
                :variant="tile.variant"
                :loading="pendingBuckets.has(tile.category)"
                :server-filtered="tile.serverFiltered"
                @click="navigateTo(tile)"
              />
            </HomeKpiGroup>
          </template>
        </div>
        <v-alert v-if="entry.groups.length === 0" type="info" density="compact" variant="tonal">
          {{ t('home.cockpit.pending_section') }}
        </v-alert>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import HomeKpiTile from './HomeKpiTile.vue';
import HomeKpiGroup from './HomeKpiGroup.vue';
import { useCockpitStore } from './cockpit.store';
import { moduleHref } from '../platform/navTargets';
import {
  HOME_KPI_CATALOG,
  HOME_SECTIONS,
  groupKpisBySection,
  kpiLabel,
  kpiDescription,
  kpiGroupLabel,
  kpiSectionTitle,
  kpiSectionListLabel,
  kpiSectionFlow,
  type HomeKpiDescriptor,
  type HomeSectionId,
  type HomeSectionSpec,
  type KpiCategory,
} from './home_kpi_catalog';

const { t } = useI18n();
const router = useRouter();

const props = defineProps<{
  /** Categories rendered on this home (cargo SPA passes cargo_*; shipment SPA passes courier_*). */
  categories: KpiCategory[];
  /** Base path for dashboard AJAX endpoints. */
  basePath?: string;
}>();

/* ----------------------------------------------------- catalog filtering */

const activeKpis = computed<HomeKpiDescriptor[]>(() =>
  HOME_KPI_CATALOG.filter((k) => props.categories.includes(k.category)),
);

/**
 * Section tree consumed by the template — `[{ section, groups: [{ group, tiles }] }, …]`.
 * Order comes from `HOME_SECTIONS` / `groupOrder` in the catalog, NOT
 * from catalog declaration order, so adding a KPI doesn't reshuffle
 * the layout.
 */
// Las secciones sin categorías reaparecen automáticamente cuando el catálogo
// les asigne una fuente; mientras tanto no mostramos pestañas vacías.
const sectionsForRender = computed(() => groupKpisBySection(activeKpis.value));
const activeSectionSpec = computed(
  () => sectionsForRender.value.find((entry) => entry.section.id === activeSection.value)?.section,
);
const sectionIds = new Set(HOME_SECTIONS.map((section) => section.id));
const initialHash = typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '');
const activeSection = ref<HomeSectionId>(
  sectionIds.has(initialHash as HomeSectionId) ? (initialHash as HomeSectionId) : 'morning',
);

const ALL_GROUPS = '__all__';
const activeGroups = ref<Partial<Record<HomeSectionId, string>>>({});

watch(
  sectionsForRender,
  (sections) => {
    for (const entry of sections) {
      if (!activeGroups.value[entry.section.id]) {
        activeGroups.value[entry.section.id] = ALL_GROUPS;
      }
    }
  },
  { immediate: true },
);

function visibleGroups(entry: {
  section: HomeSectionSpec;
  groups: Array<{ group: string; tiles: HomeKpiDescriptor[] }>;
}) {
  const selected = activeGroups.value[entry.section.id] ?? ALL_GROUPS;
  return selected === ALL_GROUPS ? entry.groups : entry.groups.filter((group) => group.group === selected);
}

watch(activeSection, (section) => {
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${section}`);
  }
});

/* ----------------------------------------------------- progressive load */

const cockpitBasePath = (props.basePath ?? '/bff/v1').replace(/\/$/, '');
// ME2: store Pinia singleton (antes un composable con estado por-montaje) —
// persiste entre visitas a Home dentro de la sesión, con TTL corto
// stale-while-revalidate (ver cockpit.store.ts).
const cockpit = useCockpitStore();
const { counts, pending: pendingBuckets, errors: sourceErrors, updatedAt } = storeToRefs(cockpit);
const error = computed<string | null>(() => {
  const entries = Object.entries(sourceErrors.value);
  return entries.length ? entries.map(([source, message]) => `${source}: ${message}`).join(' · ') : null;
});

const groupTotal = (group: { tiles: HomeKpiDescriptor[] }): number => {
  let sum = 0;
  for (const t of group.tiles) sum += counts.value[t.key] ?? 0;
  return sum;
};

/**
 * A section is loading while ANY of its declared categories is still
 * pending. We use `section.categories` (declarative) instead of
 * walking the tiles to avoid edge cases where a section has no
 * matching KPI yet — the loading state would silently flip off and
 * the operator would see an empty section.
 */
function isSectionLoading(entry: { section: HomeSectionSpec }): boolean {
  for (const cat of entry.section.categories) {
    if (pendingBuckets.value.has(cat)) return true;
  }
  return false;
}

/**
 * Cross-app navigation to a listing SPA.
 *
 * Resuelve el destino mediante la fuente central de navegacion. En operations
 * devuelve directamente `/ops/{cargo|shipment}/list`; fuera del modo
 * consolidado conserva la URL legacy. Evita pasar por el redirect PHP, que
 * historicamente podia perder el `type` que identifica el KPI.
 */
type DashboardListPage = HomeKpiDescriptor['link']['page'];

function listingBaseUrl(page: DashboardListPage): string {
  if (page === 'cargo-list') return moduleHref('cargo');
  if (page === 'crm-list') return moduleHref('crm');
  if (page === 'giacenze-list') return moduleHref('giacenze');
  return moduleHref('shipment');
}

function gotoListing(page: DashboardListPage, query: Record<string, string>): void {
  const routeNames: Record<DashboardListPage, string> = {
    'shipment-list': 'shipment-list',
    'cargo-list': 'cargo-list',
    'crm-list': 'crm-list',
    'giacenze-list': 'giacenze',
  };
  const routeName = routeNames[page];
  if (router.hasRoute(routeName)) {
    void router.push({ name: routeName, query });
    return;
  }
  const qs = new URLSearchParams(query ?? {}).toString();
  const url = qs ? `${listingBaseUrl(page)}?${qs}` : listingBaseUrl(page);
  window.location.assign(url);
}

function navigateTo(tile: HomeKpiDescriptor): void {
  gotoListing(tile.link.page, {
    ...tile.link.query,
    kpi: tile.key,
  });
}

/**
 * Section header → listing drilldown. The destination is declared on
 * `HomeSectionSpec.listLink` so adding/changing a section's "open list"
 * target is a one-line edit in `HOME_SECTIONS`.
 */
function openSectionList(section: HomeSectionSpec): void {
  gotoListing(section.listLink.page, section.listLink.query as Record<string, string>);
}

/**
 * Sum every KPI count in a section — shown next to the section header so
 * the operator sees the workload at a glance even when the section is
 * collapsed.
 */
function sectionTotal(entry: { section: HomeSectionSpec; groups: Array<{ tiles: HomeKpiDescriptor[] }> }): number {
  let sum = 0;
  for (const g of entry.groups) {
    for (const t of g.tiles) sum += counts.value[t.key] ?? 0;
  }
  return sum;
}

/**
 * Compact description used below the section title — gives context when
 * the section is collapsed (e.g. "3 categorie · 12 indicatori") so the
 * operator knows what's inside without expanding.
 */
function sectionMeta(entry: { groups: Array<{ tiles: HomeKpiDescriptor[] }> }): string {
  const groups = entry.groups.length;
  let tiles = 0;
  for (const g of entry.groups) tiles += g.tiles.length;
  // El plural lo resuelve vue-i18n con la forma `singular | plural`: antes
  // estaba en italiano hardcodeado aquí y salía «3 categorie · 13 indicatori»
  // incluso con la UI en NL/DE.
  return `${t('home.section_meta.groups', groups)} · ${t('home.section_meta.tiles', tiles)}`;
}

/**
 * QW1 — causa raíz de la lentitud al entrar al sitio: antes se pedían las
 * 6 llamadas HTTP (8 categorías de KPI) en el boot aunque solo 1 de 7
 * secciones se muestra a la vez. Ahora el boot solo pide las categorías de
 * la sección activa; el resto se precarga en segundo plano (ver
 * `schedulePrefetch`) para que cambiar de pestaña casi nunca dispare un
 * fetch nuevo.
 */
function activeSectionCategories(): KpiCategory[] {
  return sectionsForRender.value.find((entry) => entry.section.id === activeSection.value)?.section.categories ?? [];
}

/**
 * Botón "Actualizar" y retry del banner de error: ignora el TTL de ME2 y pide
 * al servidor recalcular en vez de servir su caché (acotado en el backend por
 * `Home_Kpi_Cache::MIN_REFRESH_AGE_S`). Refresca todas las secciones, no solo
 * la activa, para que ninguna quede mostrando un dato anterior a la pulsación.
 */
function reload(): void {
  cockpit.forceRefresh(undefined, cockpitBasePath);
}

/** Precarga ociosa de las secciones no activas — no bloquea el render ni compite con el fetch crítico del boot. */
function schedulePrefetch(): void {
  const remaining = HOME_SECTIONS.flatMap((section) => section.categories);
  const run = () => cockpit.ensureCategories(remaining, cockpitBasePath);
  if (typeof window === 'undefined') return;
  const ric = (window as { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number }).requestIdleCallback;
  if (ric) {
    ric(run, { timeout: 4000 });
  } else {
    window.setTimeout(run, 1500);
  }
}

// Si el usuario cambia de pestaña antes de que el prefetch ocioso llegue a
// esa sección, la pedimos al toque — `ensureCategories` es idempotente (un
// grupo fresco no dispara nada), así que nunca duplica el fetch del prefetch.
watch(activeSection, (section) => {
  const categories = sectionsForRender.value.find((entry) => entry.section.id === section)?.section.categories;
  if (categories && categories.length > 0) cockpit.ensureCategories(categories, cockpitBasePath);
});

onMounted(() => {
  // ME2: a diferencia del `reload()` del botón de retry, el boot respeta el
  // TTL — si la sección activa sigue fresca de una visita anterior reciente,
  // no repite el fetch.
  cockpit.ensureCategories(activeSectionCategories(), cockpitBasePath);
  schedulePrefetch();
});

defineExpose({ reload, updatedAt });
</script>

<style scoped lang="scss">
/* Per-section accent colors — used by the left ribbon + the icon
   badge so each domain reads as a distinct family at a glance.
   Values are picked to harmonise with the platform's primary palette
   on light themes (the only theme we ship the home in today). */
$section-accents: (
  'courier_in': rgb(99, 102, 241),
  // indigo  — inbound express
  'courier_out': rgb(14, 165, 233),
  // sky     — in-transit express
  'cargo': rgb(217, 119, 6), // amber   — cargo
);

.home-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.home-error {
  margin-bottom: 4px;
}

/* ─── section card ──────────────────────────────────────────────── */
.home-section {
  position: relative;
}
.home-section--loading {
  opacity: 0.9;
}

/* Coloured ribbon on the left edge — the single strongest signal of
   "what domain is this". 3px wide so it doesn't compete with content. */
.home-section__ribbon {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: rgba(15, 23, 42, 0.08);
}
@each $id, $color in $section-accents {
  .home-section__ribbon[data-section='#{$id}'] {
    background: #{$color};
  }
}

/* ─── header (entire row is a button) ──────────────────────────── */
.home-section__header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  /* Mismo sangrado horizontal (12px) que las tabs y la linea de flujo, para
     que cabecera, rail y cestas queden alineados en la misma vertical. */
  padding: 14px 12px 10px;
  background: transparent;
  border: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  border-radius: 0;
}

/* Coloured circular badge wrapping the section icon. Background is a
   tinted version of the section accent so it stays subtle even in the
   busy "express in entrata" section. */
.home-section__icon-badge {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.06);
  color: rgb(15, 23, 42);
}
@each $id, $color in $section-accents {
  .home-section__icon-badge[data-section='#{$id}'] {
    background: color-mix(in srgb, #{$color} 14%, transparent);
    color: #{$color};
  }
}

.home-section__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.home-section__title {
  font-size: 14.5px;
  font-weight: 700;
  letter-spacing: -0.005em;
  line-height: 1.2;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.home-section__sub {
  font-size: 11.5px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.85;
  letter-spacing: 0.01em;
}

.home-section__spacer {
  flex: 1;
}

/* Total / spinner area — fixed width container so the chevron never
   jumps around as buckets land. */
.home-section__indicator {
  flex: 0 0 auto;
  min-width: 42px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
}
.home-section__total {
  font-size: 12.5px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-feature-settings: 'tnum';
  min-width: 38px;
  text-align: center;
  line-height: 1.3;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}
/* Zero-value sections — calm down the pill so it stops shouting. */
.home-section__total--zero {
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
  box-shadow: none;
  opacity: 0.75;
}

/* Drill-into-list button — sits between the indicator and the
   chevron. Always visible (subtle) so the operator notices it; gets
   the section accent on hover to communicate "you'll land in this
   domain's listing". Uses `tabindex` so it's reachable by keyboard
   even though it's nested in the header `<button>`. */
.home-section__open {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.6;
  cursor: pointer;
  transition:
    background 0.14s ease,
    color 0.14s ease,
    opacity 0.14s ease;
}
.home-section__open:hover {
  opacity: 1;
}
.home-section__header:hover .home-section__open {
  opacity: 0.85;
}
.home-section__open:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
  opacity: 1;
}
@each $id, $color in $section-accents {
  .home-section__open[data-section='#{$id}']:hover {
    background: color-mix(in srgb, #{$color} 14%, transparent);
    color: #{$color};
  }
}

/* ─── body ───────────────────────────────────────────────────────── */
/* OJO: este elemento lleva TAMBIEN la clase `tmwe-cockpit__body`, que lo pone
   en `flex-direction: row` para dejar el rail a la izquierda y las cestas a la
   derecha. Aqui NO se declara `display`/`flex-direction`: hacerlo (como antes,
   con `column`) anulaba ese layout y apilaba el rail encima del contenido.

   Tampoco `border-top`: la seccion ya no es una tarjeta, asi que esa linea solo
   anadia una caja mas. */
.home-section__body {
  padding: 0 12px 20px;
  animation: home-section-fade-in 0.18s ease-out;
}

/* ─── per-section loading state ──────────────────────────────────── */
.home-section__loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 18px 20px;
  border-top: 1px solid rgba(15, 23, 42, 0.05);
}
.home-section__loading-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface-variant));
  letter-spacing: 0.02em;
}
.home-section__loading-spin {
  animation: home-section-spin 1.1s linear infinite;
  color: rgb(var(--v-theme-primary));
}

/* ─── animations ─────────────────────────────────────────────────── */
@keyframes home-section-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
@keyframes home-section-fade-in {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
