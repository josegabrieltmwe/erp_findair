<template>
  <div>
    <CmSectionHeader :title="t('scheduler.title')" :subtitle="summary">
      <template #actions>
        <v-btn :icon="mdiRefresh" variant="text" size="small" @click="reload" />
      </template>
    </CmSectionHeader>

    <v-tabs v-model="tab" density="compact" class="mb-3">
      <v-tab value="tasks">{{ t('scheduler.tab_tasks') }}</v-tab>
      <v-tab value="queue">{{ t('scheduler.tab_queue') }}</v-tab>
    </v-tabs>

    <QueuePanel v-if="tab === 'queue'" />

    <template v-if="tab === 'tasks'">
    <v-alert
      v-if="!loading && !error && tasks.length === 0"
      type="info"
      variant="tonal"
      class="mb-4"
      :text="t('scheduler.empty_hint')"
    />

    <ListingDataView
      v-if="!loading && !error && tasks.length > 0"
      :source="listSource"
      :headers="tableHeaders"
      :selected="selected"
      :sort-key-map="sortKeyMap"
      mode="infinite"
      :selectable="false"
      @update:selected="selected = $event"
    >
      <template #cell.health="{ item }">
        <v-tooltip :text="(item as ScheduledTask).health.reason || t(`scheduler.health.${(item as ScheduledTask).health.level}`)" location="top">
          <template #activator="{ props }">
            <v-icon
              v-bind="props"
              :icon="healthIcon((item as ScheduledTask).health.level)"
              :color="healthColor((item as ScheduledTask).health.level)"
              size="small"
            />
          </template>
        </v-tooltip>
      </template>

      <template #cell.label="{ item }">
        <div class="font-weight-medium">{{ (item as ScheduledTask).label }}</div>
        <div class="text-caption text-medium-emphasis">{{ (item as ScheduledTask).task_key }}</div>
        <div v-if="(item as ScheduledTask).last_error" class="text-caption text-error">
          {{ (item as ScheduledTask).last_error }}
        </div>
      </template>

      <template #cell.schedule="{ item }">
        <div>{{ (item as ScheduledTask).schedule.human }}</div>
        <div v-if="(item as ScheduledTask).schedule.timezone !== 'Europe/Rome'" class="text-caption text-medium-emphasis">
          {{ (item as ScheduledTask).schedule.timezone }}
        </div>
      </template>

      <template #cell.last_run="{ item }">
        <template v-if="(item as ScheduledTask).last_run?.last_run_at">
          <div>{{ (item as ScheduledTask).last_run!.last_run_at }}</div>
          <div class="text-caption text-medium-emphasis">
            <span v-if="(item as ScheduledTask).last_run!.duration_ms !== null">{{ (item as ScheduledTask).last_run!.duration_ms }} ms</span>
            <span v-if="(item as ScheduledTask).last_run!.last_error" class="text-error">
              · {{ (item as ScheduledTask).last_run!.last_error }}
            </span>
          </div>
        </template>
        <span v-else class="text-medium-emphasis">—</span>
      </template>

      <template #cell.next_run_at="{ item }">
        <span v-if="!(item as ScheduledTask).is_active" class="text-medium-emphasis">—</span>
        <span v-else-if="(item as ScheduledTask).next_run_at">{{ (item as ScheduledTask).next_run_at }}</span>
        <span v-else class="text-medium-emphasis">{{ t('scheduler.next_pending') }}</span>
      </template>

      <template #cell.is_active="{ item }">
        <v-switch
          :model-value="(item as ScheduledTask).is_active"
          color="primary"
          density="compact"
          hide-details
          inset
          :loading="busyId === (item as ScheduledTask).id"
          @update:model-value="onToggle(item as ScheduledTask, $event)"
        />
      </template>

      <template #cell.actions="{ item }">
        <v-tooltip :text="t('scheduler.run_now')" location="top">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :icon="mdiPlayCircle"
              variant="text"
              size="small"
              :loading="runningId === (item as ScheduledTask).id"
              @click="onRun(item as ScheduledTask)"
            />
          </template>
        </v-tooltip>
        <v-tooltip :text="t('scheduler.edit_schedule')" location="top">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :icon="mdiCalendarClock"
              variant="text"
              size="small"
              @click="openSchedule(item as ScheduledTask)"
            />
          </template>
        </v-tooltip>
        <v-tooltip :text="t('scheduler.params')" location="top">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :icon="mdiTune"
              variant="text"
              size="small"
              @click="openParams(item as ScheduledTask)"
            />
          </template>
        </v-tooltip>
        <v-tooltip :text="t('scheduler.history')" location="top">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :icon="mdiHistory"
              variant="text"
              size="small"
              @click="openHistory(item as ScheduledTask)"
            />
          </template>
        </v-tooltip>
      </template>
    </ListingDataView>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2">
      {{ error }}
    </v-alert>
    </template>

    <!-- Editar horario -->
    <v-dialog v-model="scheduleDialog" max-width="560">
      <v-card v-if="editing">
        <v-card-title>{{ t('scheduler.edit_schedule') }} — {{ editing.label }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="form.schedule_mode"
            :items="modeItems"
            :label="t('scheduler.mode')"
            density="compact"
            class="mb-3"
          />

          <v-text-field
            v-if="form.schedule_mode === 'interval'"
            v-model.number="form.every_n_minutes"
            type="number"
            min="1"
            :label="t('scheduler.every_n_minutes')"
            density="compact"
            class="mb-3"
          />

          <v-text-field
            v-if="form.schedule_mode !== 'interval'"
            v-model="form.run_at_time"
            :label="t('scheduler.run_at_time')"
            placeholder="06:30"
            density="compact"
            class="mb-3"
          />

          <v-text-field
            v-if="form.schedule_mode === 'monthly'"
            v-model.number="form.run_at_day"
            type="number"
            min="1"
            max="28"
            :label="t('scheduler.run_at_day')"
            :hint="t('scheduler.run_at_day_hint')"
            persistent-hint
            density="compact"
            class="mb-3"
          />

          <!-- La franja horaria solo aplica a interval; los dias tambien a
               daily (hay crons diarios solo en laborables). -->
          <template v-if="form.schedule_mode !== 'monthly'">
            <v-divider class="my-3" />
            <div class="text-caption text-medium-emphasis mb-2">{{ t('scheduler.window_hint') }}</div>
            <v-text-field
              v-if="form.schedule_mode === 'interval'"
              v-model="form.active_hours"
              :label="t('scheduler.active_hours')"
              placeholder="08:00-19:00"
              density="compact"
              clearable
              class="mb-3"
            />
            <v-select
              v-model="weekdaysSel"
              :items="weekdayItems"
              :label="t('scheduler.active_weekdays')"
              density="compact"
              multiple
              chips
              clearable
            />
          </template>

          <v-divider class="my-3" />
          <v-autocomplete
            v-model="form.timezone"
            :items="timezoneItems"
            :label="t('scheduler.timezone')"
            density="compact"
            class="mb-2"
          />
          <v-switch
            v-model="catchUp"
            :label="t('scheduler.catch_up')"
            :hint="t('scheduler.catch_up_hint')"
            persistent-hint
            color="warning"
            density="compact"
            inset
          />

          <v-divider class="my-3" />
          <div class="text-caption text-medium-emphasis mb-1">{{ t('scheduler.preview') }}</div>
          <v-progress-linear v-if="previewLoading" indeterminate class="mb-1" />
          <div v-if="previewError" class="text-caption text-error">{{ previewError }}</div>
          <div v-else-if="previewRuns.length === 0" class="text-caption text-medium-emphasis">{{ t('scheduler.preview_empty') }}</div>
          <div v-else class="d-flex flex-wrap ga-1">
            <v-chip v-for="r in previewRuns" :key="r" size="x-small" variant="tonal">{{ r }}</v-chip>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="scheduleDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveSchedule">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Historial -->
    <v-dialog v-model="historyDialog" max-width="820">
      <v-card v-if="editing">
        <v-card-title>{{ t('scheduler.history') }} — {{ editing.label }}</v-card-title>
        <v-card-text>
          <v-progress-linear v-if="historyLoading" indeterminate class="mb-3" />
          <div v-else-if="history.length === 0" class="text-medium-emphasis">
            {{ t('scheduler.history_empty') }}
          </div>
          <v-table v-else density="compact">
            <thead>
              <tr>
                <th>{{ t('scheduler.col_job') }}</th>
                <th>{{ t('scheduler.col_status') }}</th>
                <th>{{ t('scheduler.col_attempts') }}</th>
                <th>{{ t('scheduler.col_created') }}</th>
                <th>{{ t('scheduler.col_result') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in history" :key="h.job_id" class="cursor-pointer" @click="openJob(h)">
                <td>
                  #{{ h.job_id }}
                  <v-chip v-if="h.manual" size="x-small" class="ml-1">{{ t('scheduler.manual') }}</v-chip>
                </td>
                <td>
                  <v-chip :color="jobStatusColor(h.status)" size="x-small" variant="tonal">
                    {{ h.status }}
                  </v-chip>
                </td>
                <td class="text-caption">{{ h.attempts }} / {{ h.max_attempts }}</td>
                <td class="text-caption">{{ h.created }}</td>
                <td class="text-caption">
                  <span v-if="h.error_msg" class="text-error history-error">{{ h.error_msg }}</span>
                  <span v-else>{{ formatResult(h.result) }}</span>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="historyDialog = false">{{ t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <PayloadDialog v-model="paramsDialog" :task="editing" @saved="onTaskUpdated" />
    <JobDetailDialog v-model="jobDialog" :job="currentJob" @changed="onJobChanged" />
  </div>
</template>

<script setup lang="ts">
/**
 * Panel de tareas programadas — Fase A6 (último lote) del plan de
 * deprecación de `admin_config` (docs/plan-deprecacion-admin-config.md).
 * Portado desde `admin_config/src/features/scheduler/SchedulerPage.vue`.
 *
 * A diferencia del resto de features de identidad, "ejecutar ahora" tiene
 * efectos operacionales reales — encola trabajo de negocio, no solo
 * configuración. El guard anti-avalancha del backend (skipped=true en la
 * segunda llamada mientras la primera sigue corriendo) se respeta tal cual.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiRefresh,
  mdiPlayCircle,
  mdiCalendarClock,
  mdiHistory,
  mdiCheckCircle,
  mdiAlertCircle,
  mdiPauseCircle,
  mdiClockOutline,
  mdiProgressClock,
  mdiTune,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import PayloadDialog from '../components/PayloadDialog.vue';
import JobDetailDialog from '../components/JobDetailDialog.vue';
import QueuePanel from '../components/QueuePanel.vue';
import { jobStatusColor, formatResult } from '../components/format';
import {
  schedulerService,
  type ScheduledTask,
  type TaskHistoryEntry,
  type SchedulePayload,
  type HealthLevel,
} from '../services/scheduler.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const tab = ref<'tasks' | 'queue'>('tasks');
const paramsDialog = ref(false);
const jobDialog = ref(false);
const currentJob = ref<TaskHistoryEntry | null>(null);
const catchUp = ref(false);

const previewRuns = ref<string[]>([]);
const previewError = ref<string | null>(null);
const previewLoading = ref(false);
let previewTimer: ReturnType<typeof setTimeout> | undefined;

/** Zonas habituales primero; la de la tarea siempre presente. */
const timezoneItems = computed(() => {
  const base = ['Europe/Rome', 'Europe/Madrid', 'Europe/London', 'UTC', 'America/New_York', 'Asia/Shanghai'];
  const cur = form.value.timezone;
  return cur && !base.includes(cur) ? [cur, ...base] : base;
});

const loading = ref(false);
const error = ref<string | null>(null);
const tasks = ref<ScheduledTask[]>([]);
const selected = ref<{ id: number }[]>([]);

const listSource = useClientSideListSource(tasks, { loading });
const tableHeaders: DataTableHeader[] = [
  { title: '', key: 'health', sortable: false, width: 46 },
  { title: t('scheduler.col_task') as string, key: 'label' },
  { title: t('scheduler.col_schedule') as string, key: 'schedule', sortable: false },
  { title: t('scheduler.col_last_run') as string, key: 'last_run', sortable: false },
  { title: t('scheduler.col_next_run') as string, key: 'next_run_at' },
  { title: t('scheduler.col_active') as string, key: 'is_active', width: 96, align: 'center', sortable: false },
  { title: t('scheduler.col_actions') as string, key: 'actions', width: 160, align: 'end', sortable: false },
];
const sortKeyMap: Record<string, string> = { label: 'label', next_run_at: 'next_run_at' };

const busyId = ref<number | null>(null);
const runningId = ref<number | null>(null);
const saving = ref(false);

const editing = ref<ScheduledTask | null>(null);
const scheduleDialog = ref(false);
const historyDialog = ref(false);
const history = ref<TaskHistoryEntry[]>([]);
const historyLoading = ref(false);

const form = ref<SchedulePayload>({ schedule_mode: 'interval' });
const weekdaysSel = ref<number[]>([]);

// Handle de polling. Se conserva para que una tarea que esté corriendo al
// cargar el panel siga refrescándose, y para poder detenerlo al desmontar.
let pollTimer: ReturnType<typeof setInterval> | undefined;

const summary = computed(() => {
  const total = tasks.value.length;
  const active = tasks.value.filter((x) => x.is_active).length;
  const failing = tasks.value.filter((x) => x.health.level === 'error').length;
  return t('scheduler.summary', { total, active, failing });
});

const modeItems = computed(() => [
  { title: t('scheduler.mode_interval'), value: 'interval' },
  { title: t('scheduler.mode_daily'), value: 'daily' },
  { title: t('scheduler.mode_monthly'), value: 'monthly' },
]);

const weekdayItems = computed(() => [
  { title: t('scheduler.mon'), value: 1 },
  { title: t('scheduler.tue'), value: 2 },
  { title: t('scheduler.wed'), value: 3 },
  { title: t('scheduler.thu'), value: 4 },
  { title: t('scheduler.fri'), value: 5 },
  { title: t('scheduler.sat'), value: 6 },
  { title: t('scheduler.sun'), value: 7 },
]);

function healthIcon(level: HealthLevel): string {
  switch (level) {
    case 'ok': return mdiCheckCircle;
    case 'error': return mdiAlertCircle;
    case 'running': return mdiProgressClock;
    case 'stale': return mdiClockOutline;
    case 'paused': return mdiPauseCircle;
    default: return mdiClockOutline;
  }
}

function healthColor(level: HealthLevel): string {
  switch (level) {
    case 'ok': return 'success';
    case 'error': return 'error';
    case 'running': return 'info';
    case 'stale': return 'warning';
    case 'paused': return 'grey';
    default: return 'grey';
  }
}

async function reload(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    tasks.value = await schedulerService.list();
    syncPolling();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

/** Refresca silenciosamente mientras algo está corriendo; se detiene cuando no. */
function syncPolling(): void {
  const anyRunning = tasks.value.some((x) => x.last_job?.running);
  if (anyRunning && !pollTimer) {
    pollTimer = setInterval(refreshQuiet, 4000);
  } else if (!anyRunning && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

async function refreshQuiet(): Promise<void> {
  try {
    tasks.value = await schedulerService.list();
    syncPolling();
  } catch {
    // Silencioso: un refresco de fondo fallido no debe alterar el panel. El
    // siguiente tick reintenta, y el botón explícito de Refrescar muestra errores.
  }
}

async function onToggle(task: ScheduledTask, value: boolean | null): Promise<void> {
  busyId.value = task.id;
  try {
    const active = await schedulerService.setActive(task.id, value === true);
    task.is_active = active;
    // El backend limpia next_run_at al activar para que el tick lo recalcule.
    await refreshQuiet();
    toast.success(active ? t('scheduler.activated') : t('scheduler.paused'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
    await refreshQuiet();
  } finally {
    busyId.value = null;
  }
}

async function onRun(task: ScheduledTask): Promise<void> {
  runningId.value = task.id;
  try {
    let res = await schedulerService.runNow(task.id);
    if (res.skipped) {
      // Guard activado: una ejecución previa sigue activa. No es un error;
      // se ofrece forzar, con confirmación, en vez de no hacer nada.
      const force = await confirm.ask({
        title: t('scheduler.force_title'),
        message: t('scheduler.force_message', { id: res.jobId }),
        confirmLabel: t('scheduler.force_confirm'),
        variant: 'danger',
      });
      if (!force) {
        toast.info(res.message);
        return;
      }
      res = await schedulerService.runNow(task.id, true);
      toast.success(res.message || t('scheduler.enqueued'));
    } else {
      toast.success(res.message || t('scheduler.enqueued'));
    }
    await refreshQuiet();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    runningId.value = null;
  }
}

function openSchedule(task: ScheduledTask): void {
  editing.value = task;
  form.value = {
    schedule_mode: task.schedule.mode,
    every_n_minutes: task.schedule.every_n_minutes,
    run_at_time: task.schedule.run_at_time,
    run_at_day: task.schedule.run_at_day,
    active_hours: task.schedule.active_hours,
    active_weekdays: task.schedule.active_weekdays,
    timezone: task.schedule.timezone,
  };
  weekdaysSel.value = (task.schedule.active_weekdays ?? '')
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter((n) => n >= 1 && n <= 7);
  catchUp.value = task.catch_up;
  scheduleDialog.value = true;
  schedulePreview();
}

/** El horario tal como se enviará: limpia los campos que no aplican al modo. */
function schedulePayload(): SchedulePayload {
  const payload: SchedulePayload = {
    ...form.value,
    active_weekdays: weekdaysSel.value.length ? weekdaysSel.value.slice().sort().join(',') : null,
  };
  // active_hours es solo de interval; active_weekdays también aplica a daily.
  // Enviar cualquiera fuera de sus modos es un 400.
  if (payload.schedule_mode !== 'interval') {
    payload.active_hours = null;
  }
  if (payload.schedule_mode === 'monthly') {
    payload.active_weekdays = null;
  }
  return payload;
}

/** Vista previa con debounce: el servidor calcula con la misma rejilla que el tick. */
function schedulePreview(): void {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    if (!scheduleDialog.value) return;
    previewLoading.value = true;
    try {
      const r = await schedulerService.preview(schedulePayload(), 5);
      previewRuns.value = r.runs;
      previewError.value = r.error;
    } catch (e) {
      previewRuns.value = [];
      previewError.value = e instanceof Error ? e.message : String(e);
    } finally {
      previewLoading.value = false;
    }
  }, 400);
}

watch([form, weekdaysSel], schedulePreview, { deep: true });

async function saveSchedule(): Promise<void> {
  if (!editing.value) return;
  saving.value = true;
  try {
    let updated = await schedulerService.updateSchedule(editing.value.id, schedulePayload());
    if (catchUp.value !== editing.value.catch_up) {
      updated = await schedulerService.setCatchUp(editing.value.id, catchUp.value);
    }
    const idx = tasks.value.findIndex((x) => x.id === updated.id);
    if (idx >= 0) tasks.value[idx] = updated;
    scheduleDialog.value = false;
    toast.success(t('scheduler.schedule_saved'));
  } catch (e) {
    // La validación vive en el servidor, así que el mensaje aquí es el motivo real.
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function openHistory(task: ScheduledTask): Promise<void> {
  editing.value = task;
  historyDialog.value = true;
  historyLoading.value = true;
  history.value = [];
  try {
    history.value = await schedulerService.history(task.id, 20);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    historyLoading.value = false;
  }
}

function openParams(task: ScheduledTask): void {
  editing.value = task;
  paramsDialog.value = true;
}

function onTaskUpdated(updated: ScheduledTask): void {
  const idx = tasks.value.findIndex((x) => x.id === updated.id);
  if (idx >= 0) tasks.value[idx] = updated;
}

function openJob(job: TaskHistoryEntry): void {
  currentJob.value = job;
  jobDialog.value = true;
}

async function onJobChanged(): Promise<void> {
  await refreshQuiet();
  if (editing.value && historyDialog.value) {
    history.value = await schedulerService.history(editing.value.id, 20);
  }
}

onMounted(reload);
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (previewTimer) clearTimeout(previewTimer);
});
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
.history-error {
  display: inline-block;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
</style>
