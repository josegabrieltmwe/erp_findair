<template>
  <!--
    Panel de filtros de listado: drawer lateral ancho + pestañas horizontales,
    una por grupo. Sustituye al patrón anterior (drawer angosto + secciones
    plegables en columna única).

    Por qué se volvió a pestañas:
      · Con el drawer al 60% del viewport hay ancho de sobra para que las
        etiquetas de grupo quepan sin `show-arrows` — el problema que motivó
        abandonar las pestañas la vez anterior (490 px de etiquetas en un
        drawer de 460) ya no aplica con este ancho.
      · Todos los campos de un grupo se ven a la vez, en una fila horizontal
        en vez de una columna larga con scroll.

    El buscador de campos salta a la primera pestaña que matchea en vez de
    abrir/cerrar secciones. Cada pestaña lleva su contador de filtros activos
    como badge, así el estado se lee sin visitarla.

    El componente es AGNÓSTICO del dominio: recibe los grupos y sus campos por
    slot, y solo aporta el armazón (buscador, pestañas, contadores, pie). Así
    lo comparten los listados de courier y cargo sin duplicar ~580 líneas cada
    uno.
  -->
  <v-navigation-drawer
    v-model="open"
    location="right"
    :width="drawerWidth"
    temporary
    :scrim="true"
  >
    <v-toolbar density="comfortable" flat color="surface-variant">
      <v-toolbar-title class="text-subtitle-1 font-weight-medium">
        {{ title }}
      </v-toolbar-title>
      <v-spacer />
      <v-btn icon="mdi-close" variant="text" size="small" @click="open = false" />
    </v-toolbar>

    <div class="fd-search-row">
      <!-- Buscador de campos. Con 21 filtros, escribir "peso" gana a cualquier
           taxonomía: es la salida estándar cuando un panel pasa de la decena. -->
      <v-text-field
        v-model="fieldQuery"
        :placeholder="t('filters.search_placeholder')"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="fd-search"
      />
      <p v-if="fieldQuery && visibleGroups.length === 0" class="fd-empty">
        {{ t("filters.search_no_match", { q: fieldQuery }) }}
      </p>
    </div>

    <v-tabs
      v-model="activeTab"
      density="comfortable"
      color="primary"
      show-arrows
      class="fd-tabs"
    >
      <v-tab
        v-for="g in groups"
        v-show="isGroupVisible(g)"
        :key="g.key"
        :value="g.key"
        class="fd-tab"
      >
        {{ g.label }}
        <span v-if="countOf(g) > 0" class="fd-group-count">{{ countOf(g) }}</span>
      </v-tab>
    </v-tabs>

    <v-window v-model="activeTab" class="fd-body">
      <v-window-item v-for="g in groups" :key="g.key" :value="g.key" class="fd-group-body">
        <slot :name="g.key" :query="fieldQuery" />
      </v-window-item>
    </v-window>

    <template #append>
      <div class="fd-foot">
        <v-btn
          variant="text"
          color="error"
          size="small"
          :disabled="loading"
          @click="$emit('clear')"
        >
          {{ totalCount > 0 ? t("filters.clear_n", { n: totalCount }) : t("common.clear") }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" size="small" :disabled="loading" @click="open = false">
          {{ t("common.cancel") }}
        </v-btn>
        <!-- El botón dice cuántos resultados habrá, no solo "Aplicar": evita el
             ciclo aplicar–mirar–corregir y avisa del filtro que deja la lista
             vacía ANTES de aplicarlo. `previewCount` es null mientras se
             calcula, o cuando el propietario decide no calcularlo (p. ej. con
             filtros cuya consulta es cara). -->
        <v-btn
          color="primary"
          variant="flat"
          size="small"
          :loading="loading"
          @click="$emit('apply')"
        >
          {{ applyLabel }}
        </v-btn>
      </div>
    </template>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

/** Una pestaña del panel. Los campos se pintan vía el slot `key`. */
export interface FilterGroup {
  /** Identificador; es también el nombre del slot que pinta sus campos. */
  key: string;
  /** Etiqueta visible, ya traducida por el propietario. */
  label: string;
  /** Nº de filtros activos en este grupo (lo calcula el propietario). */
  count: number;
  /**
   * Texto sobre el que busca el buscador de campos: normalmente las etiquetas
   * de los campos del grupo concatenadas. Si se omite, el grupo solo casa por
   * su propio nombre.
   */
  haystack?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    groups: FilterGroup[];
    loading?: boolean;
    /** Resultados que devolvería el filtro actual. `null` = sin dato. */
    previewCount?: number | null;
    /**
     * Ancho del drawer en píxeles. `v-navigation-drawer` hace `Number(width)`
     * internamente para calcular su transform de apertura/cierre: un string
     * porcentual (p. ej. "60%") da `NaN` ahí y el drawer queda visible aunque
     * `modelValue` sea `false`. Por eso el 60% del viewport se resuelve en JS
     * (`drawerWidth`, más abajo) en vez de pasarse como string aquí.
     */
    width?: number;
  }>(),
  { loading: false, previewCount: null },
);

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "apply"): void;
  (e: "clear"): void;
}>();

const { t } = useI18n();

/**
 * 60% del ancho del viewport en px, salvo que el propietario fije `width`
 * explícitamente. Se recalcula en `resize` (no en cada render) porque
 * `v-navigation-drawer` necesita un número, nunca un string porcentual.
 */
const viewportWidth = ref(typeof window !== "undefined" ? window.innerWidth : 1280);
function onResize(): void {
  viewportWidth.value = window.innerWidth;
}
onMounted(() => window.addEventListener("resize", onResize));
onUnmounted(() => window.removeEventListener("resize", onResize));

const drawerWidth = computed(() => props.width ?? Math.round(viewportWidth.value * 0.6));

const open = ref(props.modelValue);
watch(
  () => props.modelValue,
  (v) => {
    open.value = v;
    // Al reabrir, la búsqueda de campos se descarta: es un ayudante puntual,
    // no un filtro que deba persistir entre aperturas.
    if (v) fieldQuery.value = "";
  },
);
watch(open, (v) => emit("update:modelValue", v));

const fieldQuery = ref("");

/**
 * Pestaña activa. Al abrir el panel se selecciona el primer grupo con
 * filtros puestos: así el estado se lee de un vistazo sin tener que recorrer
 * todas las pestañas. Si no hay ningún filtro puesto, se abre la primera.
 */
const activeTab = ref<string>("");

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return;
    const withFilters = props.groups.find((g) => g.count > 0);
    activeTab.value = (withFilters ?? props.groups[0])?.key ?? "";
  },
  { immediate: true },
);

function countOf(g: FilterGroup): number {
  return g.count ?? 0;
}

const totalCount = computed(() =>
  props.groups.reduce((n, g) => n + (g.count ?? 0), 0),
);

/**
 * Buscar campos filtra qué GRUPOS se ven (no campos sueltos): el grupo casa si
 * su etiqueta o su `haystack` contienen el texto. Se mantiene a nivel de grupo
 * a propósito — ocultar campos dentro de un grupo abierto deja huecos que
 * confunden más de lo que ayudan.
 */
function isGroupVisible(g: FilterGroup): boolean {
  const q = fieldQuery.value.trim().toLowerCase();
  if (!q) return true;
  return `${g.label} ${g.haystack ?? ""}`.toLowerCase().includes(q);
}

const visibleGroups = computed(() => props.groups.filter(isGroupVisible));

/**
 * Si la pestaña activa deja de casar con la búsqueda, salta a la primera que
 * sí casa — igual que antes abría el primer grupo que matcheaba.
 */
watch(fieldQuery, (q) => {
  if (!q.trim()) return;
  const current = props.groups.find((g) => g.key === activeTab.value);
  if (current && isGroupVisible(current)) return;
  const firstMatch = props.groups.find(isGroupVisible);
  if (firstMatch) activeTab.value = firstMatch.key;
});

const applyLabel = computed(() => {
  if (props.previewCount === null || props.previewCount === undefined) {
    return t("common.apply");
  }
  return t("filters.show_n_results", { n: props.previewCount.toLocaleString("en-US") });
});
</script>

<style scoped>
.fd-search-row {
  padding: 12px 14px 0;
}
.fd-search {
  margin-bottom: 4px;
}
.fd-empty {
  padding: 12px 2px;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.fd-tabs {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  flex: 0 0 auto;
}
.fd-tab {
  text-transform: none;
  letter-spacing: normal;
  font-weight: 600;
  gap: 6px;
}
.fd-group-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 17px;
  height: 17px;
  padding: 0 5px;
  border-radius: 9px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

/* El drawer es ancho (60% del viewport): los campos de cada pestaña se
   reparten en columnas en vez de apilarse en una sola, como pedía el layout
   angosto anterior. `auto-fill`/`minmax` deja 1 columna si el drawer queda
   angosto (pantallas chicas) y hasta 3 en desktop ancho. */
.fd-body {
  flex: 1 1 auto;
  overflow-y: auto;
}
.fd-group-body {
  padding: 16px 14px 14px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px 16px;
  align-content: start;
}

.fd-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
