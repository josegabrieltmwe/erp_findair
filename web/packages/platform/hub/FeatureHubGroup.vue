<template>
  <section class="fh-group" :aria-labelledby="headingId">
    <h2 :id="headingId" class="fh-group-title">{{ group.title }}</h2>
    <div class="fh-group-grid">
      <FeatureHubCard
        v-for="item in group.items"
        :key="item.key"
        :item="item"
        @open="$emit('open', $event)"
      >
        <template v-if="$slots['item-badge']" #item-badge="slotProps">
          <slot name="item-badge" v-bind="slotProps" />
        </template>
      </FeatureHubCard>
    </div>
    <slot name="group-footer" :group="group" />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FeatureHubCard from './FeatureHubCard.vue';
import type { FeatureHubGroup, FeatureHubItem } from './types';

const props = defineProps<{ group: FeatureHubGroup }>();
defineEmits<{ open: [item: FeatureHubItem] }>();

const headingId = computed(() => `fh-group-${props.group.key}`);
</script>

<style scoped>
.fh-group {
  margin-bottom: 28px;
}
.fh-group-title {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin: 0 0 10px;
}
.fh-group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}
</style>
