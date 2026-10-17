<template>
  <button class="arow" type="button" @click="$emit('click')">
    <v-icon v-if="icon" :icon="icon" size="18" />
    <div class="arow-content">
      <div class="arow-cap">{{ caption }}</div>
      <div class="arow-main">{{ main }}</div>
      <div v-if="sub" class="arow-sub">{{ sub }}</div>
      <div v-if="sub2" class="arow-sub2">{{ sub2 }}</div>
    </div>
  </button>
</template>

<script setup lang="ts">
/**
 * Mockup .arow — clickable address tile.
 * Styling owned by styles/mockup2.scss (.arow / .arow-*).
 */
defineProps<{
  icon?: string;
  caption: string;
  main: string;
  sub?: string;
  sub2?: string;
}>();
defineEmits<{ (e: 'click'): void }>();
</script>

<style scoped lang="scss">
.arow-content {
  flex: 1;
  min-width: 0;
}
</style>
