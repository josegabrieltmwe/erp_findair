<template>
  <div class="cm-async">
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      closable
      class="mb-4"
      @click:close="$emit('clear-error')"
    >
      <div class="d-flex align-center">
        <span class="flex-grow-1">{{ error }}</span>
        <v-btn v-if="retryable" size="small" variant="text" @click="$emit('retry')">
          {{ t('common.retry') }}
        </v-btn>
      </div>
    </v-alert>

    <div v-if="loading && !skipLoadingSlot" class="cm-async-loading">
      <slot name="loading">
        <CmSkeletonTable v-if="loadingType === 'skeleton'" :rows="skeletonRows" :cols="skeletonCols" />
        <template v-else>
          <v-progress-circular indeterminate color="primary" size="32" width="3" />
          <span class="ml-3 cm-text-muted">{{ t('common.loading') }}</span>
        </template>
      </slot>
    </div>

    <template v-else-if="empty">
      <slot name="empty">
        <CmEmptyState :title="t('common.empty')" />
      </slot>
    </template>

    <template v-else-if="!loading || !!data">
      <slot :data="data" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import CmEmptyState from './CmEmptyState.vue';
import CmSkeletonTable from './CmSkeletonTable.vue';

const { t } = useI18n();

withDefaults(
  defineProps<{
    loading?: boolean;
    error?: string | null;
    empty?: boolean;
    data?: unknown;
    retryable?: boolean;
    skipLoadingSlot?: boolean;
    loadingType?: 'spinner' | 'skeleton';
    skeletonRows?: number;
    skeletonCols?: number;
  }>(),
  {
    loading: false,
    error: null,
    empty: false,
    retryable: true,
    skipLoadingSlot: false,
    loadingType: 'spinner',
    skeletonRows: 6,
    skeletonCols: 5,
  },
);

defineEmits<{
  retry: [];
  'clear-error': [];
}>();
</script>

<style scoped>
.cm-async-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--cm-space-2xl) 0;
}
</style>
