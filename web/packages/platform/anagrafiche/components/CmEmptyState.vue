<template>
  <div class="cm-empty">
    <v-icon v-if="icon" :icon="icon" size="48" class="cm-empty-icon" />
    <h3 v-if="title" class="cm-empty-title">{{ title }}</h3>
    <div v-if="$slots.default" class="cm-empty-body"><slot /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string;
  title?: string;
}>();
</script>

<style scoped>
.cm-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--cm-space-3xl) var(--cm-space-lg);
  color: var(--cm-text-muted);
  min-height: 40vh;
}
.cm-empty-icon {
  margin-bottom: var(--cm-space-md);
  color: var(--cm-text-disabled);
}
.cm-empty-title {
  font-size: var(--cm-fs-md);
  font-weight: 500;
  margin: 0 0 var(--cm-space-sm);
  color: var(--cm-text-secondary);
}
.cm-empty-body {
  font-size: var(--cm-fs-base);
  color: var(--cm-text-muted);
  max-width: 480px;
}
</style>
