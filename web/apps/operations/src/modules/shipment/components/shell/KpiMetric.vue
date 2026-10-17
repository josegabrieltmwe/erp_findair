<template>
  <div
    class="kpi-metric d-flex align-center"
    :class="[
      `kpi-metric--${dense ? 'dense' : 'normal'}`,
      { 'kpi-metric--clickable': clickable, 'flex-grow-1': !dense },
    ]"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="clickable ? $emit('click') : undefined"
    @keydown.enter="clickable ? $emit('click') : undefined"
  >
    <v-icon
      :icon="icon"
      :size="dense ? 16 : 18"
      class="me-2 text-medium-emphasis"
    />
    <div style="min-width: 0; flex: 1 1 auto">
      <div
        class="text-caption text-medium-emphasis text-uppercase"
        style="letter-spacing: 0.04em; line-height: 1"
      >
        {{ label }}
      </div>
      <div
        class="font-weight-semibold mt-1"
        :class="dense ? 'text-body-2' : 'text-subtitle-1'"
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

withDefaults(
  defineProps<{
    icon: string;
    label: string;
    value: string | number;
    sublabel?: string;
    dense?: boolean;
  }>(),
  { dense: false },
);
defineEmits<{ (e: "click"): void }>();

const attrs = useAttrs();
const clickable = computed(() => "onClick" in attrs);
</script>

<style scoped>
.kpi-metric {
  transition: background 0.12s ease;
}
.kpi-metric--normal {
  min-width: 180px;
  padding: 16px;
}
.kpi-metric--dense {
  min-width: 0;
  padding: 8px 10px;
}
.kpi-metric--clickable {
  cursor: pointer;
}
.kpi-metric--clickable:hover {
  background: rgb(var(--v-theme-surface-variant), 0.5);
}
</style>
