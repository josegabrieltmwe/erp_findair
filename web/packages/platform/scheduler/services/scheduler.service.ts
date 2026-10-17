import { http } from '../../anagrafiche/services/http';

/**
 * Tareas programadas (TMWE admin) — Fase A6 del plan de deprecación de
 * `admin_config` (docs/plan-deprecacion-admin-config.md). Portado 1:1 desde
 * `admin_config/src/services/scheduler.service.ts`. Único de los 10 lotes
 * de identidad/seguridad con efectos operacionales reales — "ejecutar
 * ahora" encola trabajo de negocio de verdad (no es solo configuración).
 * Auditoría propia vía Log_Modifiche (no permission_audit_log, a
 * diferencia del resto del grupo).
 *
 * Backend: /admin_scheduler_api (Web_Scheduler_Controller — auth híbrida).
 *   - GET  ?                     → listado de tareas con estado derivado
 *   - GET  ?id&history=1         → historial de ejecución
 *   - GET  ?job_id               → sondea un job lanzado desde el panel
 *   - GET  ?queue=1              → cola viva de todos los tipos
 *   - POST op=run|toggle|schedule|payload|catch_up
 *   - POST op=preview            → próximas ejecuciones de un horario (no guarda)
 *   - POST op=cancel_job|retry_job job_id
 *
 * Las escrituras usan POST con `op` en vez de PATCH: `action` es un
 * parámetro reservado del router en este proyecto, así que los verbos
 * viajan en `op`.
 */

const ENDPOINT = 'admin_scheduler_api';

export type ScheduleMode = 'interval' | 'daily' | 'monthly';

export type HealthLevel = 'ok' | 'error' | 'running' | 'stale' | 'idle' | 'paused';

export interface TaskSchedule {
  mode: ScheduleMode;
  every_n_minutes: number | null;
  run_at_time: string | null;
  run_at_day: number | null;
  active_hours: string | null;
  active_weekdays: string | null;
  timezone: string;
  /** Resumen legible generado en el servidor (p. ej. "Cada 15 min, 08:00-19:00, L-V"). */
  human: string;
}

export interface TaskLastJob {
  job_id: number;
  status: string;
  progress_done: number;
  progress_total: number;
  errors: number;
  error_msg: string | null;
  run_id: string | null;
  created: string | null;
  updated: string | null;
  attempts: number;
  available_at: string | null;
  /** pending o running — el panel hace polling mientras esto sea true. */
  running: boolean;
  /** Pendiente de un reintento con backoff. */
  retrying: boolean;
}

export interface TaskLastRun {
  cron_name: string;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  duration_ms: number | null;
  metrics: Record<string, unknown>;
}

export interface TaskHealth {
  level: HealthLevel;
  reason: string;
}

export type PayloadFieldType = 'bool' | 'int' | 'float' | 'string';

/** Campo editable del payload, declarado por el backend (Job_Handler_Registry). */
export interface PayloadField {
  key: string;
  type: PayloadFieldType;
  label: string;
  /** Cambia efectos externos (emails, escrituras): pide confirmación. */
  danger?: boolean;
  options?: string[];
  /** Lo que aplica el handler si la clave falta. Se muestra, no se escribe. */
  default?: string | number | boolean | null;
}

export interface JobMeta {
  max_runtime_s: number;
  lock_key: string;
  retry: { max_attempts: number; backoff_s: number };
  payload_fields: PayloadField[];
}

export interface ScheduledTask {
  id: number;
  task_key: string;
  job_type: string;
  label: string;
  description: string | null;
  is_active: boolean;
  catch_up: boolean;
  schedule: TaskSchedule;
  payload: Record<string, unknown>;
  next_run_at: string | null;
  last_enqueued_at: string | null;
  last_job: TaskLastJob | null;
  last_run: TaskLastRun | null;
  health: TaskHealth;
  /** Motivo por el que el tick pausó la tarea (horario inválido). */
  last_error: string | null;
  job_meta: JobMeta;
}

/** Un job, tal como lo ven el historial de una tarea y la cola. */
export interface JobView {
  job_id: number;
  job_type: string;
  task_key: string | null;
  status: string;
  created: string | null;
  updated: string | null;
  run_id: string | null;
  attempts: number;
  max_attempts: number;
  available_at: string | null;
  locked_by: string | null;
  progress_done: number;
  progress_total: number;
  errors: number;
  error_msg: string | null;
  result: Record<string, unknown>;
  payload: Record<string, unknown>;
  age_s: number | null;
  idle_s: number | null;
  max_runtime_s: number;
  /** En curso sin latir más allá de su tiempo máximo. */
  overdue: boolean;
  /** Lanzado desde el panel (tiene id_anagrafica) en vez de por el tick automático. */
  manual: boolean;
}

/** Compatibilidad: el historial devuelve la misma forma que la cola. */
export type TaskHistoryEntry = JobView;

export interface JobStatus {
  id: number;
  job_type: string;
  status: string;
  progress_done: number;
  progress_total: number;
  errors: number;
  result: Record<string, unknown> | null;
  error_msg: string | null;
}

export interface RunResult {
  jobId: number;
  /** True cuando una ejecución previa seguía activa y no se encoló nada nuevo. */
  skipped: boolean;
  message: string;
}

/** Campos del horario que el panel puede editar. */
export interface SchedulePayload {
  schedule_mode: ScheduleMode;
  every_n_minutes?: number | null;
  run_at_time?: string | null;
  run_at_day?: number | null;
  active_hours?: string | null;
  active_weekdays?: string | null;
  timezone?: string;
}

interface RawListResponse {
  success?: boolean;
  error?: string;
  tasks?: ScheduledTask[];
}

interface RawTaskResponse {
  success?: boolean;
  error?: string;
  task?: ScheduledTask;
  message?: string;
}

interface RawHistoryResponse {
  success?: boolean;
  error?: string;
  history?: TaskHistoryEntry[];
}

interface RawRunResponse {
  success?: boolean;
  error?: string;
  job_id?: number;
  skipped?: boolean;
  message?: string;
}

interface RawToggleResponse {
  success?: boolean;
  error?: string;
  is_active?: boolean;
  message?: string;
}

interface RawQueueResponse {
  success?: boolean;
  error?: string;
  queue?: JobView[];
}

interface RawPreviewResponse {
  success?: boolean;
  error?: string;
  runs?: string[];
}

interface RawJobActionResponse {
  success?: boolean;
  error?: string;
  job_id?: number;
  message?: string;
}

interface RawJobStatusResponse {
  success?: boolean;
  error?: string;
  job?: JobStatus;
}

export const schedulerService = {
  async list(): Promise<ScheduledTask[]> {
    const raw = await http<RawListResponse>(ENDPOINT);
    if (raw?.success === false) throw new Error(raw.error || 'No se pudo cargar la lista');
    return raw?.tasks ?? [];
  },

  async get(id: number): Promise<ScheduledTask> {
    const raw = await http<RawTaskResponse>(ENDPOINT, { query: { id } });
    if (raw?.success === false || !raw?.task) throw new Error(raw?.error || 'Tarea no encontrada');
    return raw.task;
  },

  async history(id: number, limit = 20): Promise<TaskHistoryEntry[]> {
    const raw = await http<RawHistoryResponse>(ENDPOINT, { query: { id, history: 1, limit } });
    if (raw?.success === false) throw new Error(raw.error || 'No se pudo cargar el historial');
    return raw?.history ?? [];
  },

  /**
   * Ejecuta una tarea ahora, ignorando su horario.
   *
   * Sin `force` sigue aplicando el guard anti-avalancha: pulsar dos veces
   * no apila trabajo — la segunda llamada vuelve con skipped=true.
   */
  async runNow(id: number, force = false): Promise<RunResult> {
    const raw = await http<RawRunResponse>(ENDPOINT, {
      method: 'POST',
      body: { op: 'run', id, force: force ? 1 : 0 },
    });
    if (raw?.success === false) throw new Error(raw.error || 'No se pudo lanzar la tarea');
    return {
      jobId: raw?.job_id ?? 0,
      skipped: raw?.skipped ?? false,
      message: raw?.message ?? '',
    };
  },

  async setActive(id: number, active: boolean): Promise<boolean> {
    const raw = await http<RawToggleResponse>(ENDPOINT, {
      method: 'POST',
      body: { op: 'toggle', id, active: active ? 'S' : 'N' },
    });
    if (raw?.success === false) throw new Error(raw.error || 'No se pudo cambiar el estado');
    return raw?.is_active ?? active;
  },

  /** Validado en el servidor: un horario inválido vuelve como 400 con el motivo. */
  async updateSchedule(id: number, schedule: SchedulePayload): Promise<ScheduledTask> {
    const raw = await http<RawTaskResponse>(ENDPOINT, {
      method: 'POST',
      body: { op: 'schedule', id, ...schedule },
    });
    if (raw?.success === false || !raw?.task) throw new Error(raw?.error || 'Horario no válido');
    return raw.task;
  },

  async updatePayload(id: number, payload: Record<string, unknown>): Promise<ScheduledTask> {
    const raw = await http<RawTaskResponse>(ENDPOINT, {
      method: 'POST',
      body: { op: 'payload', id, payload_json: JSON.stringify(payload) },
    });
    if (raw?.success === false || !raw?.task) throw new Error(raw?.error || 'Parámetros no válidos');
    return raw.task;
  },

  async setCatchUp(id: number, catchUp: boolean): Promise<ScheduledTask> {
    const raw = await http<RawTaskResponse>(ENDPOINT, {
      method: 'POST',
      body: { op: 'catch_up', id, catch_up: catchUp ? 'S' : 'N' },
    });
    if (raw?.success === false || !raw?.task) throw new Error(raw?.error || 'No se pudo cambiar la política');
    return raw.task;
  },

  /**
   * Próximas ejecuciones de un horario sin guardarlo. Un horario inválido no
   * es una excepción aquí: vuelve el motivo para mostrarlo junto al formulario.
   */
  async preview(schedule: SchedulePayload, n = 5): Promise<{ runs: string[]; error: string | null }> {
    const raw = await http<RawPreviewResponse>(ENDPOINT, {
      method: 'POST',
      body: { op: 'preview', n, ...schedule },
    });
    return { runs: raw?.runs ?? [], error: raw?.success === false ? (raw.error || 'Horario no válido') : null };
  },

  /** Cola viva: pendientes, en curso y fallidos de las últimas 24 h. */
  async queue(): Promise<JobView[]> {
    const raw = await http<RawQueueResponse>(ENDPOINT, { query: { queue: 1 } });
    if (raw?.success === false) throw new Error(raw.error || 'No se pudo cargar la cola');
    return raw?.queue ?? [];
  },

  /** Solo pendientes: uno en curso lo cierra el reaper. */
  async cancelJob(jobId: number): Promise<string> {
    const raw = await http<RawJobActionResponse>(ENDPOINT, {
      method: 'POST',
      body: { op: 'cancel_job', job_id: jobId },
    });
    if (raw?.success === false) throw new Error(raw.error || 'No se pudo cancelar');
    return raw?.message ?? '';
  },

  /**
   * Encola un job NUEVO con el mismo tipo y payload. Si pertenece a una tarea
   * que ya tiene una ejecución en curso, vuelve skipped=true salvo `force`.
   */
  async retryJob(jobId: number, force = false): Promise<RunResult> {
    const raw = await http<RawRunResponse>(ENDPOINT, {
      method: 'POST',
      body: { op: 'retry_job', job_id: jobId, force: force ? 1 : 0 },
    });
    if (raw?.success === false) throw new Error(raw.error || 'No se pudo reintentar');
    return { jobId: raw?.job_id ?? 0, skipped: raw?.skipped ?? false, message: raw?.message ?? '' };
  },

  /** Progreso de un job lanzado con runNow (para polling). */
  async pollJob(jobId: number): Promise<JobStatus> {
    const raw = await http<RawJobStatusResponse>(ENDPOINT, { query: { job_id: jobId } });
    if (raw?.success === false || !raw?.job) throw new Error(raw?.error || 'Job no encontrado');
    return raw.job;
  },
};
