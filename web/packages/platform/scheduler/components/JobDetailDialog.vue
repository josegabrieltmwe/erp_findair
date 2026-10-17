<template>
  <v-dialog :model-value="modelValue" max-width="760" @update:model-value="emit('update:modelValue', $event)">
    <v-card v-if="job">
      <v-card-title class="d-flex align-center ga-2">
        {{ t('scheduler.job_detail') }} #{{ job.job_id }}
        <v-chip :color="jobStatusColor(job.status)" size="small" variant="tonal">{{ job.status }}</v-chip>
        <v-chip v-if="job.overdue" color="error" size="small" variant="flat">{{ t('scheduler.overdue') }}</v-chip>
      </v-card-title>
      <v-card-text>
        <v-table density="compact" class="mb-4">
          <tbody>
            <tr><th class="w-33">{{ t('scheduler.col_type') }}</th><td>{{ job.job_type }}</td></tr>
            <tr v-if="job.task_key"><th>{{ t('scheduler.col_task') }}</th><td>{{ job.task_key }}</td></tr>
            <tr>
              <th>{{ t('scheduler.col_attempts') }}</th>
              <td>{{ job.attempts }} / {{ job.max_attempts }}</td>
            </tr>
            <tr><th>{{ t('scheduler.col_created') }}</th><td>{{ job.created }}</td></tr>
            <tr><th>{{ t('scheduler.col_updated') }}</th><td>{{ job.updated }}</td></tr>
            <tr v-if="job.available_at && job.status === 'pending'">
              <th>{{ t('scheduler.retry_at') }}</th><td>{{ job.available_at }}</td>
            </tr>
            <tr v-if="job.locked_by"><th>{{ t('scheduler.col_process') }}</th><td>{{ job.locked_by }}</td></tr>
            <tr v-if="job.status === 'running'">
              <th>{{ t('scheduler.col_heartbeat') }}</th>
              <td>{{ formatSeconds(job.idle_s) }} / {{ formatSeconds(job.max_runtime_s) }}</td>
            </tr>
            <tr v-if="job.run_id">
              <th>{{ t('scheduler.run_id') }}</th>
              <td>
                <code>{{ job.run_id }}</code>
                <v-btn :icon="mdiContentCopy" variant="text" size="x-small" :title="t('scheduler.copy')" @click="copy(job.run_id)" />
              </td>
            </tr>
          </tbody>
        </v-table>

        <template v-if="job.error_msg">
          <div class="text-subtitle-2 mb-1">{{ t('scheduler.error_full') }}</div>
          <pre class="job-pre text-error mb-4">{{ job.error_msg }}</pre>
        </template>

        <template v-if="hasKeys(job.result)">
          <div class="text-subtitle-2 mb-1">{{ t('scheduler.result') }}</div>
          <pre class="job-pre mb-4">{{ pretty(job.result) }}</pre>
        </template>

        <template v-if="hasKeys(job.payload)">
          <div class="text-subtitle-2 mb-1">{{ t('scheduler.payload') }}</div>
          <pre class="job-pre">{{ pretty(job.payload) }}</pre>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-btn
          v-if="job.status === 'pending'"
          color="error"
          variant="text"
          :loading="busy"
          @click="cancel"
        >
          {{ t('scheduler.cancel_job') }}
        </v-btn>
        <v-btn
          v-if="job.status === 'done' || job.status === 'failed'"
          color="primary"
          variant="text"
          :loading="busy"
          @click="retry"
        >
          {{ t('scheduler.retry_job') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">{{ t('common.close') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Detalle de un job: error completo (ya no se trunca a 255), métricas,
 * payload y el run_id para buscar la ejecución en Elasticsearch.
 *
 * Acciones: cancelar un job que aún no ha empezado, o reintentar uno
 * terminado (encola una copia; el original no se toca). Un job en curso no se
 * cancela desde aquí: tiene el lock de su grupo y lo cierra el reaper al
 * superar su tiempo máximo.
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiContentCopy } from '@mdi/js';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { schedulerService, type JobView } from '../services/scheduler.service';
import { jobStatusColor, formatSeconds } from './format';

const props = defineProps<{ modelValue: boolean; job: JobView | null }>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'changed'): void;
}>();

const { t } = useI18n();
const confirm = useConfirm();
const toast = useToastStore();
const busy = ref(false);

function hasKeys(o: Record<string, unknown> | null | undefined): boolean {
  return !!o && Object.keys(o).length > 0;
}

function pretty(o: unknown): string {
  return JSON.stringify(o, null, 2);
}

function copy(text: string): void {
  navigator.clipboard.writeText(text).then(
    () => toast.success(t('scheduler.copied')),
    () => toast.error(text),
  );
}

async function cancel(): Promise<void> {
  if (!props.job) return;
  const ok = await confirm.ask({
    message: t('scheduler.cancel_job_confirm', { id: props.job.job_id }),
    confirmLabel: t('scheduler.cancel_job'),
    variant: 'danger',
  });
  if (!ok) return;
  busy.value = true;
  try {
    await schedulerService.cancelJob(props.job.job_id);
    toast.success(t('scheduler.job_cancelled'));
    emit('changed');
    emit('update:modelValue', false);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = false;
  }
}

async function retry(): Promise<void> {
  if (!props.job) return;
  const ok = await confirm.ask({
    message: t('scheduler.retry_job_confirm', { id: props.job.job_id, type: props.job.job_type }),
    confirmLabel: t('scheduler.retry_job'),
  });
  if (!ok) return;
  busy.value = true;
  try {
    let res = await schedulerService.retryJob(props.job.job_id);
    if (res.skipped) {
      const force = await confirm.ask({
        title: t('scheduler.force_title'),
        message: t('scheduler.force_message', { id: res.jobId }),
        confirmLabel: t('scheduler.force_confirm'),
        variant: 'danger',
      });
      if (!force) return;
      res = await schedulerService.retryJob(props.job.job_id, true);
    }
    toast.success(t('scheduler.job_requeued', { id: res.jobId }));
    emit('changed');
    emit('update:modelValue', false);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.job-pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 4px;
  padding: 8px;
  max-height: 260px;
  overflow: auto;
}
</style>
