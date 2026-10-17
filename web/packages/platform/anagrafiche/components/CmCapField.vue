<template>
  <v-text-field
    :model-value="modelValue"
    :label="label"
    :disabled="disabled"
    :loading="loadingCap"
    density="compact"
    variant="outlined"
    @update:model-value="onInput"
    @blur="onBlur"
  />
</template>

<script setup lang="ts">
/**
 * CmCapField — campo CAP con lookup dependiente del país. Al perder el foco (o
 * con debounce al teclear) resuelve el CAP contra cap_city_prov y EMITE el
 * resultado (`resolved`) para que el formulario padre rellene provincia y
 * ciudad, respetando su propia lógica de "no sobrescribir si ya hay valor".
 * No muta campos hermanos directamente.
 */
import { toRef } from 'vue';
import { useAddressGeo } from '../composables/useAddressGeo';

const props = withDefaults(
  defineProps<{
    modelValue: string | null | undefined;
    country?: string | null;
    label?: string;
    disabled?: boolean;
    /** Composable compartido opcional: si el padre ya tiene uno, evita duplicar. */
    geo?: ReturnType<typeof useAddressGeo>;
  }>(),
  { country: '', label: '', disabled: false, geo: undefined },
);

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
  resolved: [payload: { provShort: string | null; cities: string[] }];
}>();

// Usa el composable del padre si se pasó; si no, crea uno propio.
const geo = props.geo ?? useAddressGeo(toRef(props, 'country') as never);
const { loadingCap } = geo;

function onInput(v: string | null): void {
  emit('update:modelValue', v);
}

async function onBlur(): Promise<void> {
  const cap = (props.modelValue ?? '').trim();
  if (cap.length < 3) return;
  const r = await geo.lookupCap(cap);
  emit('resolved', r);
}
</script>
