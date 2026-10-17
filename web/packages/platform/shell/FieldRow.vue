<template>
  <div class="field-row d-flex align-baseline">
    <div class="field-row__label text-caption text-medium-emphasis">{{ label }}</div>
    <div
      class="field-row__value text-body-2 font-weight-medium"
      :class="{ 'font-mono': mono }"
    >
      {{ value }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  mono?: boolean;
}>();
</script>

<style scoped>
.field-row__label {
  width: 130px;
  flex-shrink: 0;
}
.field-row__value {
  flex: 1;
  min-width: 0;
}
.font-mono {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.875em;
}
</style>
