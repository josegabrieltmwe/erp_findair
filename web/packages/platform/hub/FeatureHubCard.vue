<template>
  <!--
    Tarjeta de un item del hub. Es un enlace real (<a>), no un div con click:
    debe ser accesible por teclado y abrir en pestaña nueva con
    Ctrl/Cmd+click como cualquier link.
  -->
  <a
    :href="href"
    class="fh-card"
    :class="{ 'fh-card--warning': item.warning }"
    @click.prevent="$emit('open', item)"
  >
    <v-icon :icon="item.icon" size="22" class="fh-card-icon" aria-hidden="true" />
    <div class="fh-card-body">
      <div class="fh-card-title">
        {{ item.title }}
        <v-chip v-if="item.badge !== undefined" size="x-small" class="fh-card-badge">
          {{ item.badge }}
        </v-chip>
      </div>
      <p v-if="item.description" class="fh-card-desc">{{ item.description }}</p>
      <slot name="item-badge" :item="item" />
    </div>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { FeatureHubItem } from './types';

const props = defineProps<{ item: FeatureHubItem }>();
defineEmits<{ open: [item: FeatureHubItem] }>();

const router = useRouter();
// Resuelve por nombre de ruta, nunca un path literal: si la ruta cambia de
// path el link sigue funcionando sin tocar el descriptor.
const href = computed(() => router.resolve({ name: props.item.routeName }).href);
</script>

<style scoped>
.fh-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
  text-decoration: none;
  color: inherit;
  transition: border-color 0.12s ease, background-color 0.12s ease;
  min-height: 40px;
}
.fh-card:hover,
.fh-card:focus-visible {
  border-color: rgba(var(--v-theme-primary), 0.5);
  background: rgba(var(--v-theme-primary), 0.04);
}
.fh-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.fh-card--warning {
  border-color: rgba(var(--v-theme-warning), 0.5);
}
.fh-card-icon {
  flex-shrink: 0;
  color: rgb(var(--v-theme-primary));
  margin-top: 2px;
}
.fh-card-body {
  min-width: 0;
  flex: 1;
}
.fh-card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  font-size: 0.925rem;
  color: rgb(var(--v-theme-on-surface));
}
.fh-card-desc {
  margin: 2px 0 0;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.65);
  overflow-wrap: break-word;
}
.fh-card-badge {
  flex-shrink: 0;
}
</style>
