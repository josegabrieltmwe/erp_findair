<template>
  <button class="stat-tile" type="button" @click="$emit('click')">
    <div class="stat-row">
      <v-icon v-if="icon" :icon="icon" size="16" />
      <span class="stat-cap">{{ caption }}</span>
    </div>
    <div class="stat-val" :class="variant">
      {{ value }}<small v-if="unit"> {{ unit }}</small>
    </div>
    <div v-if="$slots.sub" class="stat-sub">
      <slot name="sub" />
    </div>
  </button>
</template>

<script setup lang="ts">
/**
 * Mockup .stat tile. Renders raw HTML so styling is governed entirely
 * by styles/mockup2.scss (.stat-tile). Acts as a button — emits @click
 * for the parent to open the matching modal.
 */
defineProps<{
  icon?: string;
  caption: string;
  value: string | number;
  unit?: string;
  /** Semantic tint of the main value text. */
  variant?: 'default' | 'success' | 'warning' | 'error';
}>();
defineEmits<{ (e: 'click'): void }>();
</script>
