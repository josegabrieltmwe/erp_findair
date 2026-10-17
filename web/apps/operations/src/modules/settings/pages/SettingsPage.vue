<template>
  <div class="st-page">
    <div class="st-header">
      <h1 class="st-title">{{ t('settings.settings.title') }}</h1>
      <v-text-field
        v-model="query"
        :label="t('settings.settings.search_placeholder')"
        :aria-label="t('settings.settings.search_placeholder')"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="st-search"
      />
    </div>

    <template v-if="visibleGroups.length > 0">
      <v-tabs v-model="activeGroup" class="st-tabs" color="primary" show-arrows>
        <v-tab v-for="group in visibleGroups" :key="group.key" :value="group.key">
          <v-icon :icon="group.icon" size="17" class="mr-2" />
          {{ group.title }}
          <span class="st-tab-count">{{ group.items.length }}</span>
        </v-tab>
      </v-tabs>

      <section
        v-for="group in visibleGroups"
        v-show="activeGroup === group.key"
        :key="group.key"
        class="st-panel"
        :class="{ 'st-panel--split': group.subgroups.length > 1 }"
      >
        <!-- Rail vertical interno (mismo patrón que AnagraficaDetailPage.vue):
             solo aparece si el tab declara más de una subcategoría con
             resultados — un tab con una sola subcategoría, o sin ninguna
             declarada (p. ej. "Organización"), se queda como cuadrícula plana. -->
        <v-tabs
          v-if="group.subgroups.length > 1"
          :model-value="activeSubgroup[group.key]"
          direction="vertical"
          class="st-rail"
          color="primary"
          density="comfortable"
          @update:model-value="(v) => setActiveSubgroup(group.key, String(v))"
        >
          <v-tab v-for="sub in group.subgroups" :key="sub.key" :value="sub.key">
            <v-icon :icon="sub.icon" class="mr-2" size="18" />
            {{ sub.title }}
            <span class="st-rail-count">{{ sub.items.length }}</span>
          </v-tab>
        </v-tabs>

        <div class="st-grid-wrap">
          <div class="st-grid">
            <SettingsCard
              v-for="item in visibleItemsFor(group)"
              :key="item.key"
              :href="item.href"
              :route-name="item.routeName"
              :route-params="item.routeParams"
              :icon="item.icon"
              :title="item.title"
              :description="item.description"
            />
          </div>
        </div>
      </section>
    </template>
    <v-alert v-else type="info" variant="tonal" density="comfortable" class="st-empty">
      <div>{{ t('settings.settings.empty') }}</div>
      <v-btn v-if="query" size="small" variant="text" class="st-empty-clear" @click="query = ''">
        {{ t('settings.settings.clear_search') }}
      </v-btn>
    </v-alert>
  </div>
</template>

<script setup lang="ts">
/**
 * Hub de accesos directos a las secciones de configuración (solo TMWE — gate
 * en el menú vía `adminOnly`, ver `OperationsNav.vue`). Cada tarjeta abre su
 * sección de una de dos formas, según `settingsCatalog.ts`:
 *   - `routeName`: la sección ya se movió a `packages/platform/<feature>` y
 *     tiene una ruta montada en el propio router de operations → navega
 *     embebida, SIN recarga.
 *   - `href`: la sección todavía solo vive en `admin_config` → enlace
 *     externo, con recarga (igual que el ítem "Admin" de OperationsNav).
 *
 * Navegación en dos niveles:
 *   1. Tabs horizontales (mismo patrón que `@shared/dashboard/HomePage.vue`):
 *      un grupo = un tab.
 *   2. Dentro de cada tab, si el grupo declara más de una subcategoría
 *      (`SETTINGS_CATALOG[].subgroups`), un rail vertical (mismo patrón que
 *      `AnagraficaDetailPage.vue`/`extraTabs.ts` en la ficha de cliente)
 *      filtra las tarjetas por subcategoría. Un tab sin subgrupos, o con uno
 *      solo, se queda como cuadrícula plana — no se fuerza jerarquía donde
 *      no aporta (caso "Organización", con una sola tarjeta).
 *
 * El buscador filtra tarjetas en ambos niveles: si el tab o la subcategoría
 * activos se quedan sin resultados tras teclear, salta automáticamente al
 * primero que sí tenga.
 *
 * Deliberadamente NO reutiliza `@shared/hub/FeatureHubPage.vue` (el mismo
 * componente que arma el hub interno de `admin_config`): ese componente solo
 * sabe navegar por `routeName` vía `router.push` — no tiene noción de `href`
 * externo, que sigue haciendo falta mientras queden secciones sin mover. En
 * vez de extender el contrato compartido para este caso mixto, esta página
 * arma su propio grid pequeño y autocontenido.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import SettingsCard from '../components/SettingsCard.vue';
import { SETTINGS_CATALOG } from '../settingsCatalog';

const { t } = useI18n();
const router = useRouter();
const query = ref('');

interface ResolvedItem {
  key: string;
  href?: string;
  routeName?: string;
  routeParams?: Record<string, string>;
  icon: string;
  title: string;
  description?: string;
  subgroup?: string;
  /** Título + descripción + categoría + aliases, ya normalizados (sin
   *  diacríticos, minúsculas) — precomputado una vez por ítem, no en cada
   *  tecleo del buscador. */
  searchIndex: string;
}
interface ResolvedSubgroup {
  key: string;
  title: string;
  icon: string;
  items: ResolvedItem[];
}
interface ResolvedGroup {
  key: string;
  title: string;
  icon: string;
  items: ResolvedItem[];
  /** Subcategorías con resultados, en el orden declarado en el catálogo. */
  subgroups: ResolvedSubgroup[];
}

/** minúsculas + sin diacríticos + espacios colapsados, para que "Configuracion"
 *  (sin tilde) encuentre "Configuración" y "  zonas" encuentre "zonas". */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

const groups = computed<ResolvedGroup[]>(() =>
  SETTINGS_CATALOG.map((g) => {
    const groupTitle = t('settings.settings.groups.' + g.i18nKey);
    const items = g.items.map((it) => {
      const title = t('settings.settings.catalog.' + it.i18nKey + '.title');
      const description = t('settings.settings.catalog.' + it.i18nKey + '.description');
      const searchIndex = normalize(
        [title, description, groupTitle, ...(it.aliases ?? [])].join(' '),
      );
      return {
        key: it.key,
        href: it.href,
        routeName: it.routeName,
        routeParams: it.routeParams,
        icon: it.icon,
        title,
        description,
        subgroup: it.subgroup,
        searchIndex,
      };
    });
    const subgroups = (g.subgroups ?? []).map((sg) => ({
      key: sg.key,
      title: t('settings.settings.subgroups.' + sg.i18nKey) as string,
      icon: sg.icon,
      items: items.filter((it) => it.subgroup === sg.key),
    }));
    return { key: g.key, title: groupTitle, icon: g.icon, items, subgroups };
  }),
);

const visibleGroups = computed<ResolvedGroup[]>(() => {
  const q = normalize(query.value ?? '');
  if (!q) return groups.value;
  return groups.value
    .map((g) => {
      const items = g.items.filter((it) => it.searchIndex.includes(q));
      const itemKeys = new Set(items.map((it) => it.key));
      const subgroups = g.subgroups
        .map((sg) => ({ ...sg, items: sg.items.filter((it) => itemKeys.has(it.key)) }))
        .filter((sg) => sg.items.length > 0);
      return { ...g, items, subgroups };
    })
    .filter((g) => g.items.length > 0);
});

/** Devuelve las tarjetas a pintar en la cuadrícula del tab: filtradas por la
 *  subcategoría activa cuando el tab tiene rail, o todas cuando no. */
function visibleItemsFor(group: ResolvedGroup): ResolvedItem[] {
  if (group.subgroups.length <= 1) return group.items;
  const active = activeSubgroup[group.key];
  return group.items.filter((it) => it.subgroup === active);
}

const activeGroup = ref<string>(SETTINGS_CATALOG[0]?.key ?? '');
/** Subcategoría activa por grupo (clave = group.key) — cada tab recuerda su
 *  propio rail al volver a él, igual que el rail de la ficha de cliente
 *  conserva la pestaña activa mientras el registro no cambia. */
const activeSubgroup = reactive<Record<string, string>>({});
function setActiveSubgroup(groupKey: string, subgroupKey: string): void {
  activeSubgroup[groupKey] = subgroupKey;
}

// Si el tab activo desaparece del resultado filtrado (sin matches con la
// búsqueda actual), saltar al primero que sí tenga — igual que el buscador
// de Home no deja al operador mirando una pestaña vacía. Lo mismo para la
// subcategoría activa de cada grupo.
watch(visibleGroups, (list) => {
  if (list.length === 0) return;
  if (!list.some((g) => g.key === activeGroup.value)) {
    activeGroup.value = list[0].key;
  }
  for (const g of list) {
    if (g.subgroups.length === 0) continue;
    const current = activeSubgroup[g.key];
    if (!current || !g.subgroups.some((sg) => sg.key === current)) {
      activeSubgroup[g.key] = g.subgroups[0].key;
    }
  }
}, { immediate: true });

// Contrato del catálogo: toda tarjeta con `routeName` debe apuntar a una
// ruta realmente registrada en el router de operations — si no, el click
// cae en un 404 silencioso. Solo en dev: un catálogo con un nombre de ruta
// desactualizado no debe hacer fallar el build ni el runtime de producción,
// pero sí debe ser imposible de pasar por alto en desarrollo.
onMounted(() => {
  if (!import.meta.env.DEV) return;
  const missing: string[] = [];
  for (const g of SETTINGS_CATALOG) {
    for (const it of g.items) {
      if (it.routeName && !router.hasRoute(it.routeName)) {
        missing.push(`${it.key} → routeName "${it.routeName}"`);
      }
    }
  }
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      '[settingsCatalog] routeName sin ruta registrada en el router:\n' +
        missing.map((m) => '  - ' + m).join('\n'),
    );
  }
});
</script>

<style scoped>
.st-page {
  padding: 16px 20px 32px;
}
.st-header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.st-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}
.st-search {
  max-width: 320px;
  margin-left: auto;
}
.st-tabs {
  margin-bottom: 4px;
}
.st-tab-count {
  margin-left: 8px;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgb(var(--v-theme-on-surface-variant));
  font-feature-settings: 'tnum';
}
.st-panel {
  padding-top: 16px;
  animation: st-panel-fade-in 0.18s ease-out;
}
/* Con rail: layout de dos columnas, igual que .cm-detail-shell en
   AnagraficaDetailPage.vue (rail a la izquierda, contenido a la derecha). */
.st-panel--split {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}
.st-rail {
  flex: 0 0 220px;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  padding: 0 8px 0 0;
}
.st-rail :deep(.v-tab) {
  justify-content: flex-start;
  min-height: 38px;
  margin-bottom: 2px;
  border-radius: 8px;
  text-transform: none;
  letter-spacing: normal;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}
.st-rail :deep(.v-tab:hover) {
  background: rgb(var(--v-theme-surface-variant));
}
.st-rail :deep(.v-tab.v-tab--selected) {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
.st-rail :deep(.v-tab__slider) {
  display: none;
}
.st-rail :deep(.v-tab .v-btn__overlay) {
  opacity: 0 !important;
}
.st-rail-count {
  margin-left: auto;
  padding-left: 8px;
  font-size: 11px;
  font-weight: 700;
  font-feature-settings: 'tnum';
  opacity: 0.6;
}
.st-grid-wrap {
  flex: 1 1 auto;
  min-width: 0;
}
.st-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}
.st-empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.st-empty-clear {
  flex-shrink: 0;
}
@keyframes st-panel-fade-in {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* < 900px: el rail vertical no cabe con legibilidad al lado del grid — se
   apila arriba, igual que el criterio de AnagraficaDetailPage.vue para su
   propio breakpoint compacto. */
@media (max-width: 900px) {
  .st-panel--split {
    flex-direction: column;
  }
  .st-rail {
    flex: 0 0 auto;
    width: 100%;
    border-right: 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    padding: 0 0 8px;
  }
}
</style>
