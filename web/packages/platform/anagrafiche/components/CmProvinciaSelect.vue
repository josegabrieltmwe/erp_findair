<template>
  <!-- Modo texto libre: países sin provincias registradas (usa_prov=N). -->
  <v-text-field
    v-if="effectiveMode === 'free'"
    :model-value="modelValue"
    :label="label"
    :disabled="disabled"
    maxlength="5"
    density="compact"
    variant="outlined"
    @update:model-value="onUpdate"
  />
  <!-- Modo select: países con provincias/estados (usa_prov ∈ S,F). -->
  <v-autocomplete
    v-else
    :model-value="modelValue"
    :items="items"
    :loading="loading"
    :label="label"
    :disabled="disabled || !country"
    :clearable="clearable"
    item-title="title"
    item-value="code"
    density="compact"
    variant="outlined"
    auto-select-first
    @update:model-value="onUpdate"
  />
</template>

<script setup lang="ts">
/**
 * CmProvinciaSelect — selector reutilizable de provincia/estado dependiente del
 * país. value = code (sigla). Si el país no usa provincias, se comporta como
 * campo de texto libre. Puede recibir el modo/items desde useAddressGeo
 * (recomendado) o resolverlos solo (mode='auto').
 */
import { computed, ref, watch } from 'vue';
import { countryFlagsService } from '../services/countryFlags.service';
import { provinceService, type ProvinceOption } from '../services/province.service';

const props = withDefaults(
  defineProps<{
    modelValue: string | null | undefined;
    country?: string | null;
    /** 'select' | 'free' provistos por el composable, o 'auto' para resolver solo. */
    mode?: 'select' | 'free' | 'auto';
    /** Lista de provincias provista por el composable (evita doble fetch). */
    provinceItems?: ProvinceOption[];
    label?: string;
    disabled?: boolean;
    clearable?: boolean;
  }>(),
  { country: '', mode: 'auto', provinceItems: () => [], label: '', disabled: false, clearable: true },
);

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

const loading = ref(false);
const autoMode = ref<'select' | 'free'>('free');
const autoItems = ref<ProvinceOption[]>([]);

// Modo efectivo: si el padre pasa 'select'/'free', se respeta; si 'auto', se resuelve.
const effectiveMode = computed<'select' | 'free'>(() =>
  props.mode === 'auto' ? autoMode.value : props.mode,
);

const sourceItems = computed<ProvinceOption[]>(() =>
  props.mode === 'auto' ? autoItems.value : props.provinceItems,
);

const items = computed(() => {
  const list = sourceItems.value.map((p) => ({ code: p.code, title: `${p.code} — ${p.name}` }));
  // Preserva el valor actual aunque no esté en el catálogo.
  const cur = (props.modelValue ?? '').toUpperCase();
  if (cur && !list.some((i) => i.code.toUpperCase() === cur)) {
    list.unshift({ code: props.modelValue as string, title: props.modelValue as string });
  }
  return list;
});

function onUpdate(v: string | null): void {
  emit('update:modelValue', v || null);
}

// Resolución autónoma (mode='auto'): decide select/free y carga provincias.
async function resolveAuto(iso: string): Promise<void> {
  const code = (iso ?? '').trim().toUpperCase();
  if (!code) {
    autoMode.value = 'free';
    autoItems.value = [];
    return;
  }
  loading.value = true;
  try {
    const flags = await countryFlagsService.get(code);
    if (flags.prov === 'S' || flags.prov === 'F') {
      autoItems.value = await provinceService.list(code);
      autoMode.value = autoItems.value.length > 0 ? 'select' : 'free';
    } else {
      autoMode.value = 'free';
      autoItems.value = [];
    }
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.country,
  (c) => {
    if (props.mode === 'auto') resolveAuto(c ?? '');
  },
  { immediate: true },
);
</script>
