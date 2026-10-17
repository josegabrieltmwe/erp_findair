<template>
  <div class="fh-page">
    <div class="fh-page-header">
      <FeatureHubSearch v-model="query" :placeholder="searchPlaceholder" />
      <div v-if="$slots['header-actions']" class="fh-page-header-actions">
        <slot name="header-actions" />
      </div>
    </div>

    <template v-if="visibleGroups.length > 0">
      <FeatureHubGroup
        v-for="group in visibleGroups"
        :key="group.key"
        :group="group"
        @open="$emit('open', $event)"
      >
        <template v-if="$slots['item-badge']" #item-badge="slotProps">
          <slot name="item-badge" v-bind="slotProps" />
        </template>
        <template v-if="$slots['group-footer']" #group-footer="slotProps">
          <slot name="group-footer" v-bind="slotProps" />
        </template>
      </FeatureHubGroup>
    </template>

    <div v-else class="fh-page-empty">
      <slot name="empty">
        <EmptyState :title="emptyTitle" :icon="mdiMagnify" />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Hub genérico dirigido por descriptores.
 *
 * No importa rutas, servicios ni i18n de ningún host: recibe los grupos ya
 * resueltos (`groups`) y un predicado de permisos (`allowed`) y solo agrupa,
 * filtra y busca. Cualquier app (admin_config, operations, u otra futura)
 * puede montarlo pasando sus propios datos.
 *
 * La visibilidad que produce `allowed` es política de navegación, no control
 * de seguridad: el backend exige su propio chequeo de autorización aparte —
 * igual que documenta `anagrafiche/utils/extraTabs.ts` para las pestañas
 * contextuales.
 *
 * @see docs/plan-admin-navigation-shared-ui-consolidation.md §6.3
 */
import { computed, ref } from 'vue';
import { mdiMagnify } from '@mdi/js';
import EmptyState from '../ui/EmptyState.vue';
import FeatureHubGroup from './FeatureHubGroup.vue';
import FeatureHubSearch from './FeatureHubSearch.vue';
import { filterAllowedGroups, searchGroups } from './hubGroups';
import type { FeatureHubGroup as FeatureHubGroupT, FeatureHubItem, FeatureHubPermissionCheck } from './types';

const props = withDefaults(
  defineProps<{
    groups: FeatureHubGroupT[];
    allowed: FeatureHubPermissionCheck;
    /** Ya traducidos por el host. */
    searchPlaceholder?: string;
    emptyTitle?: string;
  }>(),
  {
    searchPlaceholder: '',
    emptyTitle: '',
  },
);

defineEmits<{ open: [item: FeatureHubItem] }>();

const query = ref('');

const allowedGroups = computed(() => filterAllowedGroups(props.groups, props.allowed));
const visibleGroups = computed(() => searchGroups(allowedGroups.value, query.value));
</script>

<style scoped>
.fh-page {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 4px 24px;
}
.fh-page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.fh-page-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.fh-page-empty {
  padding: 48px 0;
}
</style>
