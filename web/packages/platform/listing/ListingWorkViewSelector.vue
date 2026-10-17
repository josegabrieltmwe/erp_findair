<template>
  <v-select
    class="listing-work-view-selector"
    data-testid="work-view-selector"
    :model-value="modelValue"
    :items="items"
    item-title="title"
    item-value="value"
    :label="label"
    :aria-label="label"
    density="compact"
    variant="outlined"
    hide-details
    @update:model-value="emit('update:modelValue', String($event))"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ListingWorkView } from "./types";

const props = defineProps<{
  modelValue: string;
  views: readonly ListingWorkView[];
  label: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const { t } = useI18n();
const items = computed(() =>
  props.views.map((view) => ({ title: t(view.labelKey), value: view.id })),
);
</script>

<style scoped>
.listing-work-view-selector {
  width: 168px;
  min-width: 144px;
}
</style>
