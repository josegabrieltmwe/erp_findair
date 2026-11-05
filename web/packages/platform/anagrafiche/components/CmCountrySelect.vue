<template>
  <v-autocomplete
    :model-value="modelValue"
    :items="items"
    :loading="loading"
    :label="label"
    :disabled="disabled"
    :rules="rules"
    :clearable="clearable"
    item-title="label"
    item-value="value"
    density="compact"
    variant="outlined"
    :auto-select-first="autoSelectFirst"
    :custom-filter="() => true"
    @update:model-value="onUpdate"
    @update:search="onSearch"
  >
    <!-- Selected flag as a FIXED prepend icon, not a #selection slot. A custom
         #selection kept the chip rendered while typing, so Vuetify pushed the
         search input onto a second line and the field grew to two rows ("jump"
         on search). With the flag in prepend-inner the selection uses Vuetify's
         native single-line rendering (label — ISO), which the search text
         simply replaces in place. -->
    <template v-if="selectedFlag" #prepend-inner>
      <span class="cm-flag">{{ selectedFlag }}</span>
    </template>
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps">
        <template #prepend>
          <span class="cm-flag mr-2">{{ item.raw.flag }}</span>
        </template>
      </v-list-item>
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts">
/**
 * CmCountrySelect — selector reutilizable de país (paesi_iso) con bandera.
 * value = código ISO2 (los formularios guardan el código, no el id).
 * La bandera es un emoji Unicode (regional indicators), sin dependencias.
 *
 * Búsqueda: el filtro de Vuetify se desactiva (`custom-filter` siempre true) y
 * la lista se ordena por relevancia (rankCountries): ISO exacto, ISO que empieza
 * por, nombre que empieza por, nombre que contiene. Los nombres van en el idioma
 * de la UI (Intl.DisplayNames). Enter solo autoselecciona con una coincidencia
 * fuerte (ISO o prefijo), nunca con una simple subcadena.
 */
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { paesiService, type PaeseOption } from '../services/paesi.service';
import { countryIsoToFlagEmoji } from '../utils/currencyCountry';
import { rankCountries } from '../utils/countryRanking';

const props = withDefaults(
  defineProps<{
    modelValue: string | null | undefined;
    label?: string;
    disabled?: boolean;
    clearable?: boolean;
    rules?: Array<(v: unknown) => boolean | string>;
  }>(),
  { label: '', disabled: false, clearable: true, rules: () => [] },
);

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

const loading = ref(false);
const countries = ref<PaeseOption[]>([]);
const search = ref('');

function uiLocale(): () => string {
  try {
    const { locale } = useI18n({ useScope: 'global' });
    return () => String(locale.value || 'es');
  } catch {
    return () =>
      (typeof document !== 'undefined' && document.documentElement.lang) || 'es';
  }
}
const currentLocale = uiLocale();

// Flag emoji of the currently-selected country, shown as a fixed prepend icon.
const selectedFlag = computed(() => {
  const cur = (props.modelValue ?? '').toUpperCase();
  return cur ? countryIsoToFlagEmoji(cur) : '';
});

interface CountryItem {
  value: string;
  label: string;
  flag: string;
}

function labelOf(iso: string, name: string): string {
  return `${iso} — ${name}`.trim();
}

// Etiqueta del valor seleccionado: Vuetify la vuelca en `search` al enfocar, y
// no debe filtrar la lista (equivale a no haber escrito nada).
const selectedLabel = computed(() => {
  const cur = (props.modelValue ?? '').toUpperCase();
  if (!cur) return '';
  const hit = rankCountries(countries.value, '', currentLocale()).find((r) => r.iso === cur);
  return hit ? labelOf(hit.iso, hit.name) : cur;
});

const effectiveSearch = computed(() => {
  const q = search.value.trim();
  return q === selectedLabel.value ? '' : q;
});

const ranked = computed(() =>
  rankCountries(countries.value, effectiveSearch.value, currentLocale()),
);

// Enter autoselecciona solo con coincidencia fuerte (ISO exacto/prefijo o
// nombre que empieza por); con una mera subcadena el usuario elige.
const autoSelectFirst = computed(
  () => !effectiveSearch.value || (ranked.value[0]?.score ?? 99) <= 2,
);

const items = computed<CountryItem[]>(() => {
  // El value es el código ISO de 2 letras del país (columna ISO), que es lo
  // que guardan las sedes en id_paese_iso — NO el ISO2 (subdivisiones).
  const list = ranked.value.map((r) => ({
    value: r.iso,
    label: labelOf(r.iso, r.name),
    flag: countryIsoToFlagEmoji(r.iso),
  }));
  // Conserva el valor actual seleccionable aunque no esté en el catálogo (o
  // no coincida con la búsqueda: Vuetify necesita el item para su etiqueta).
  const cur = (props.modelValue ?? '').toUpperCase();
  if (cur && !list.some((i) => i.value === cur)) {
    const known = countries.value.some((c) => String(c.ISO ?? '').toUpperCase() === cur);
    const item = { value: cur, label: selectedLabel.value || cur, flag: countryIsoToFlagEmoji(cur) };
    if (known && effectiveSearch.value) list.push(item);
    else list.unshift(item);
  }
  return list;
});

function onSearch(q: string | null): void {
  search.value = q ?? '';
}

function onUpdate(v: string | null): void {
  emit('update:modelValue', v ? v.toUpperCase() : null);
}

onMounted(async () => {
  loading.value = true;
  try {
    countries.value = await paesiService.list();
  } catch {
    /* silencioso: el campo sigue usable con el valor persistido */
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.cm-flag {
  font-size: 1.1em;
  line-height: 1;
}
</style>
