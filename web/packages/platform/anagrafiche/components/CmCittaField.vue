<template>
  <v-combobox
    :model-value="modelValue"
    :items="suggestions"
    :label="label"
    :disabled="disabled"
    density="compact"
    variant="outlined"
    auto-select-first
    hide-no-data
    :menu-props="{ maxHeight: 300 }"
    @update:model-value="onUpdate"
  />
</template>

<script setup lang="ts">
/**
 * CmCittaField — campo ciudad editable con sugerencias. El backend no ofrece
 * búsqueda de ciudad por nombre; las sugerencias son las `cities[]` derivadas
 * del último CAP resuelto (pasadas por prop desde useAddressGeo). El usuario
 * puede escribir libremente (v-combobox).
 */
withDefaults(
  defineProps<{
    modelValue: string | null | undefined;
    /** Ciudades sugeridas (cities[] del último lookup de CAP). */
    suggestions?: string[];
    label?: string;
    disabled?: boolean;
  }>(),
  { suggestions: () => [], label: '', disabled: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

function onUpdate(v: string | null): void {
  emit('update:modelValue', typeof v === 'string' ? v : (v ?? null));
}
</script>
