<template>
  <!--
    Compact segmented control for switching the data view mode between
    paginated and infinite scroll. Designed to live in the dashboard
    topbar next to the action buttons (refresh, theme), so the user
    has a single place to control "how do I see the list".
  -->
  <div class="sdv-mode-toggle" role="group" :aria-label="t('platform.view.aria')">
    <button
      type="button"
      class="sdv-mode-btn"
      :class="{ 'is-active': modelValue === 'paginated' }"
      :title="t('platform.view.paginated_title')"
      @click="$emit('update:modelValue', 'paginated')"
    >
      <v-icon icon="mdi-table" size="14" />
      <span>{{ t('platform.view.pages') }}</span>
    </button>
    <button
      type="button"
      class="sdv-mode-btn"
      :class="{ 'is-active': modelValue === 'infinite' }"
      :title="t('platform.view.infinite_title')"
      @click="$emit('update:modelValue', 'infinite')"
    >
      <v-icon icon="mdi-infinity" size="14" />
      <span>{{ t('platform.view.scroll') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ListViewMode } from './useListViewMode';

const { t } = useI18n();

defineProps<{
  modelValue: ListViewMode;
}>();
defineEmits<{
  (e: 'update:modelValue', v: ListViewMode): void;
}>();
</script>
