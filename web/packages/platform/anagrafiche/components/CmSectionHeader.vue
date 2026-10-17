<template>
  <header class="cm-section-header">
    <div class="cm-section-header-text">
      <h1 class="cm-section-title">{{ title }}</h1>
      <p v-if="subtitle" class="cm-section-subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="cm-section-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<style scoped>
.cm-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--cm-space-lg);
  margin-bottom: var(--cm-space-lg);
  flex-wrap: wrap;
}
.cm-section-header-text {
  flex: 1;
  min-width: 0;
}
.cm-section-title {
  font-size: var(--cm-fs-xl);
  font-weight: 500;
  margin: 0;
  color: var(--cm-text-primary);
}
.cm-section-subtitle {
  font-size: var(--cm-fs-sm);
  color: var(--cm-text-muted);
  margin: 4px 0 0;
}
.cm-section-header-actions {
  display: flex;
  gap: var(--cm-space-sm);
  flex-wrap: wrap;
}
</style>
