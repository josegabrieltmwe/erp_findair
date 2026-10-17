/** Utilidades de presentación compartidas por el panel de tareas programadas. */

export function jobStatusColor(status: string): string {
  if (status === 'done') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'running') return 'info';
  return 'grey';
}

/** 75 → "75 s", 3700 → "1 h 1 min". */
export function formatSeconds(s: number | null | undefined): string {
  if (s === null || s === undefined) return '—';
  if (s < 120) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 120) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ${m % 60} min` : `${Math.floor(h / 24)} d`;
}

/** Renderizado compacto de una línea de las métricas del handler. */
export function formatResult(result: Record<string, unknown> | null | undefined): string {
  const entries = Object.entries(result ?? {}).filter(([k]) => k !== 'job_id');
  if (entries.length === 0) return '—';
  return entries
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(', ');
}
