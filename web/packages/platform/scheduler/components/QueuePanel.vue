<template>
  <div>
    <div class="d-flex align-center mb-2">
      <div class="text-caption text-medium-emphasis">{{ t('scheduler.queue_hint') }}</div>
      <v-spacer />
      <v-btn :icon="mdiRefresh" variant="text" size="small" :loading="loading" @click="load" />
    </div>

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-2">{{ error }}</v-alert>

    <div v-if="!loading && jobs.length === 0 && !error" class="text-medium-emphasis pa-4">
      {{ t('scheduler.queue_empty') }}
    </div>

    <v-table v-else density="compact" hover>
      <thead>
        <tr>
          <th>{{ t('scheduler.col_job') }}</th>
          <th>{{ t('scheduler.col_type') }}</th>
          <th>{{ t('scheduler.col_status') }}</th>
          <th>{{ t('scheduler.col_attempts') }}</th>
          <th>{{ t('scheduler.col_age') }}</th>
          <th>{{ t('scheduler.col_heartbeat') }}</th>
          <th>{{ t('scheduler.col_result') }}</th>
          <th class="text-end">{{ t('scheduler.col_actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="j in jobs" :key="j.job_id" class="cursor-pointer" @click="open(j)">
          <td>
            #{{ j.job_id }}
            <v-chip v-if="j.manual" size="x-small" class="ml-1">{{ t('scheduler.manual') }}</v-chip>
          </td>
          <td>
            <div>{{ j.job_type }}</div>
            <div v-if="j.task_key && j.task_key !== j.job_type" class="text-caption text-medium-emphasis">{{ j.task_key }}</div>
          </td>
          <td>
            <v-chip :color="jobStatusColor(j.status)" size="x-small" variant="tonal">{{ j.status }}</v-chip>
            <v-chip v-if="j.overdue" color="error" size="x-small" variant="flat" class="ml-1">{{ t('scheduler.overdue') }}</v-chip>
            <div v-if="j.status === 'pending' && j.available_at" class="text-caption text-medium-emphasis">
              {{ t('scheduler.retry_at') }} {{ j.available_at }}
            </div>
          </td>
          <td>{{ j.attempts }} / {{ j.max_attempts }}</td>
          <td class="text-caption">{{ formatSeconds(j.age_s) }}</td>
          <td class="text-caption">
            <template v-if="j.status === 'running'">
              <span :class="{ 'text-error': j.overdue }">{{ formatSeconds(j.idle_s) }}</span>
              <span class="text-medium-emphasis"> / {{ formatSeconds(j.max_runtime_s) }}</span>
              <div v-if="j.locked_by" class="text-medium-emphasis">{{ j.locked_by }}</div>
            </template>
            <span v-else class="text-medium-emphasis">—</span>
          </td>
          <td class="text-caption result-cell">
            <span v-if="j.error_msg" class="text-error">{{ j.error_msg }}</span>
            <span v-else>{{ formatResult(j.result) }}</span>
          </td>
          <td class="text-end" @click.stop>
            <v-btn :icon="mdiInformationOutline" variant="text" size="small" :title="t('scheduler.job_detail')" @click="open(j)" />
          </td>
        </tr>
      </tbody>
    </v-table>

    <JobDetailDialog v-model="detailOpen" :job="current" @changed="load" />
  </div>
</template>

<script setup lang="ts">
/**
 * La cola viva de TODOS los tipos: pendientes, en curso y fallidos de las
 * últimas 24 h, también los on-demand que no pertenecen a ninguna tarea.
 *
 * Es donde se ve el fallo que antes era invisible: un job en curso más allá
 * de su tiempo máximo (marca "colgado") bloquea su grupo, y los pendientes de
 * ese grupo se quedan esperando detrás.
 *
 * Se refresca sola mientras la pestaña está montada.
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiRefresh, mdiInformationOutline } from '@mdi/js';
import { schedulerService, type JobView } from '../services/scheduler.service';
import JobDetailDialog from './JobDetailDialog.vue';
import { jobStatusColor, formatSeconds, formatResult } from './format';

const REFRESH_MS = 5000;

const { t } = useI18n();

const jobs = ref<JobView[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const detailOpen = ref(false);
const current = ref<JobView | null>(null);

let timer: ReturnType<typeof setInterval> | undefined;

async function load(): Promise<void> {
  loading.value = true;
  try {
    jobs.value = await schedulerService.queue();
    error.value = null;
    // El detalle abierto sigue al job refrescado.
    if (current.value) {
      current.value = jobs.value.find((j) => j.job_id === current.value!.job_id) ?? current.value;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function open(j: JobView): void {
  current.value = j;
  detailOpen.value = true;
}

onMounted(() => {
  load();
  timer = setInterval(load, REFRESH_MS);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
.result-cell {
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
