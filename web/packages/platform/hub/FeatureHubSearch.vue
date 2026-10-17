<template>
  <v-text-field
    :model-value="modelValue"
    :placeholder="placeholder"
    :prepend-inner-icon="mdiMagnify"
    density="compact"
    variant="outlined"
    hide-details
    clearable
    class="fh-search"
    :aria-label="placeholder"
    @update:model-value="$emit('update:modelValue', $event ?? '')"
  />
</template>

<script setup lang="ts">
import { mdiMagnify } from '@mdi/js';

defineProps<{
  modelValue: string;
  /** Ya traducido por el host — el hub no conoce su namespace i18n. */
  placeholder: string;
}>();
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<style scoped>
.fh-search {
  max-width: 360px;
}
</style>
