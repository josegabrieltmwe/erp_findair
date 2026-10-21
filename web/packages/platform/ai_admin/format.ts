/** Formateadores puros de la administración de IA (probados en aiAdmin.service.spec.ts). */

/** Céntimos -> importe con dos decimales; `null` = coste desconocido. */
export function formatCost(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return (cents / 100).toFixed(2);
}

export function formatMinutes(seconds: number | null | undefined): string {
  if (!seconds) return '0';
  return (seconds / 60).toFixed(1);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** `""` -> `null`; número válido y >= 0 -> entero; inválido -> `undefined`. */
export function parseLimit(raw: string | number | null | undefined): number | null | undefined {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

/** Los flags booleanos viajan como texto (`value VARCHAR`). */
export function flagIsOn(value: string | null | undefined): boolean {
  return ['1', 'true', 'on', 'yes'].includes(String(value ?? '').toLowerCase());
}

export function flagToValue(on: boolean): string {
  return on ? '1' : '0';
}

export interface MemoryGroup {
  user_id: number;
  count: number;
  size: number;
  last: string;
}

/** Agrupa los metadatos de memoria por usuario (sin contenido, solo recuentos). */
export function groupMemoryByUser(items: { user_id: number; created_at: string; size_chars: number }[]): MemoryGroup[] {
  const map = new Map<number, MemoryGroup>();
  for (const it of items) {
    const g = map.get(it.user_id) ?? { user_id: it.user_id, count: 0, size: 0, last: it.created_at };
    g.count += 1;
    g.size += it.size_chars;
    if (it.created_at > g.last) g.last = it.created_at;
    map.set(it.user_id, g);
  }
  return [...map.values()].sort((a, b) => a.user_id - b.user_id);
}
