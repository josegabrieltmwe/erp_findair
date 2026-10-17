<template>
  <v-snackbar
    v-for="toast in toasts.items"
    :key="toast.id"
    :model-value="true"
    :color="kindColor(toast.kind)"
    :timeout="-1"
    location="top right"
    multi-line
    @update:model-value="(v) => !v && toasts.dismiss(toast.id)"
  >
    <!-- Announce to assistive tech: errors interrupt (assertive), the rest wait (polite). -->
    <span :role="ariaRole(toast.kind)" :aria-live="ariaLive(toast.kind)">{{ toast.message }}</span>
    <template #actions>
      <v-btn variant="text" @click="toasts.dismiss(toast.id)">{{ t('common.close') }}</v-btn>
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useToastStore, type ToastKind } from '@shared/stores/toast.store';

const toasts = useToastStore();
const { t } = useI18n();

function kindColor(kind: ToastKind): string {
  switch (kind) {
    case 'success': return 'success';
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'info':
    default: return 'info';
  }
}

/** Errors/warnings interrupt the screen reader; success/info are announced when idle. */
function ariaLive(kind: ToastKind): 'assertive' | 'polite' {
  return kind === 'error' || kind === 'warning' ? 'assertive' : 'polite';
}

function ariaRole(kind: ToastKind): 'alert' | 'status' {
  return kind === 'error' || kind === 'warning' ? 'alert' : 'status';
}
</script>
