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
    auto-select-first
    @update:model-value="onUpdate"
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
 */
import { computed, onMounted, ref } from 'vue';
import { paesiService, type PaeseOption } from '../services/paesi.service';
import { countryIsoToFlagEmoji } from '../utils/currencyCountry';

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

const items = computed<CountryItem[]>(() => {
  const list = countries.value.map((c) => {
    // El value es el código ISO de 2 letras del país (columna ISO), que es lo
    // que guardan las sedes en id_paese_iso — NO el ISO2 (subdivisiones).
    const iso = String(c.ISO ?? '').toUpperCase();
    return {
      value: iso,
      label: `${iso} — ${c.nome ?? ''}`.trim(),
      flag: countryIsoToFlagEmoji(iso),
    };
  });
  // Conserva el valor actual seleccionable aunque no esté en el catálogo.
  const cur = (props.modelValue ?? '').toUpperCase();
  if (cur && !list.some((i) => i.value === cur)) {
    list.unshift({ value: cur, label: cur, flag: countryIsoToFlagEmoji(cur) });
  }
  return list;
});

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
