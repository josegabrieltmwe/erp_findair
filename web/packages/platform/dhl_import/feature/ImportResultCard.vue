<template>
  <v-card variant="outlined" max-width="720">
    <div class="pa-4">
      <div class="d-flex align-center mb-3">
        <v-icon
          :icon="report.failed > 0 ? mdiAlertCircleOutline : mdiCheckCircleOutline"
          :color="report.failed > 0 ? 'error' : 'success'"
          size="24"
          class="mr-2"
        />
        <span class="text-subtitle-1">
          {{ report.failed > 0
            ? t('dhl_import.result_failed', { n: report.failed })
            : t('dhl_import.result_success', { n: report.imported }) }}
        </span>
      </div>

      <v-alert v-if="report.errors_truncated" type="info" variant="tonal" density="compact" class="mb-3">
        {{ t('dhl_import.errors_truncated') }}
      </v-alert>

      <v-table v-if="report.errors.length" density="compact">
        <thead>
          <tr>
            <th style="width:70px">{{ t('dhl_import.row') }}</th>
            <th>{{ t('dhl_import.error_message') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(err, i) in report.errors" :key="i">
            <td>{{ err.row }}</td>
            <td>
              {{ err.message }}
              <div v-if="err.line" class="di-error-line">{{ err.line }}</div>
            </td>
          </tr>
        </tbody>
      </v-table>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { mdiCheckCircleOutline, mdiAlertCircleOutline } from '@mdi/js';
import type { ImportReport } from '../services/dhlImport.service';

defineProps<{
  report: ImportReport;
  t: (key: string, params?: Record<string, unknown>) => string;
}>();
</script>

<style scoped>
.di-error-line {
  font-size: var(--cm-fs-xs, 0.75rem);
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-family: monospace;
}
</style>
