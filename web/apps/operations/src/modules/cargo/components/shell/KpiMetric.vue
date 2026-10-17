<template>
  <div
    class="kpi-metric flex-grow-1 pa-4 d-flex align-center"
    :class="{ 'kpi-metric--clickable': clickable }"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="clickable ? $emit('click') : undefined"
    @keydown.enter="clickable ? $emit('click') : undefined"
  >
    <v-icon :icon="icon" size="18" class="me-3 text-medium-emphasis" />
    <div style="min-width: 0">
      <div
        class="text-caption text-medium-emphasis text-uppercase"
        style="letter-spacing: 0.04em; line-height: 1"
      >
        {{ label }}
      </div>
      <div
        class="text-subtitle-1 font-weight-semibold mt-1"
        style="line-height: 1.1"
      >
        {{ value }}
      </div>
      <div
        v-if="sublabel"
        class="text-caption text-medium-emphasis mt-1"
        style="line-height: 1"
      >
        {{ sublabel }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";

defineProps<{
  icon: string;
  label: string;
  value: string | number;
  sublabel?: string;
}>();
defineEmits<{ (e: "click"): void }>();

const attrs = useAttrs();
const clickable = computed(() => "onClick" in attrs);
</script>

<style scoped>
.kpi-metric {
  min-width: 180px;
  transition: background 0.12s ease;
}
.kpi-metric--clickable {
  cursor: pointer;
}
.kpi-metric--clickable:hover {
  background: rgb(var(--v-theme-surface-variant), 0.5);
}
</style>
