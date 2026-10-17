/**
 * Lógica pura de la emisión mensual por tandas (sin Vue ni red).
 *
 * Reglas de seguridad (emitir es fiscal e irreversible):
 *  - una tanda nunca se reintenta;
 *  - cualquier fallo de la llamada (corte, tiempo agotado, 5xx, 422 de fecha,
 *    403, otros 4xx) PARA toda la ejecución;
 *  - un 200 con errores por cliente NO para: los errores son por cliente.
 *  - tras un corte/5xx/timeout la tanda queda "incierta": puede haberse
 *    emitido parcialmente.
 */
import {
  toResultRows,
  type EmitResponse,
  type ResultRow,
} from "./monthlyBilling.service";

export const DEFAULT_BATCH_SIZE = 25;

/** Parte la lista en tandas de `size` clientes (sin duplicados, orden estable). */
export function chunkClientIds(
  ids: number[],
  size: number = DEFAULT_BATCH_SIZE,
): number[][] {
  const n = Number.isFinite(size) && size >= 1 ? Math.floor(size) : DEFAULT_BATCH_SIZE;
  const uniq = [...new Set(ids)];
  const out: number[][] = [];
  for (let i = 0; i < uniq.length; i += n) out.push(uniq.slice(i, i + n));
  return out;
}

export type BatchFailureKind =
  | "date" // 422 INVOICE_DATE_NOT_CHRONOLOGICAL: rechazada, nada emitido
  | "forbidden" // 403: rechazada, nada emitido
  | "rejected" // otro 4xx: rechazada, nada emitido
  | "uncertain"; // sin respuesta / 5xx: puede haberse emitido algo

export interface BatchFailure {
  kind: BatchFailureKind;
  message: string;
}

/** Clasifica el fallo de una tanda. Todos los fallos paran la ejecución. */
export function classifyBatchFailure(e: unknown): BatchFailure {
  const err = e as { status?: number; errorCode?: string; message?: string } | null;
  const message = err?.message ?? "";
  if (err?.status === 422 && err.errorCode === "INVOICE_DATE_NOT_CHRONOLOGICAL")
    return { kind: "date", message };
  if (err?.status === 403) return { kind: "forbidden", message };
  if (!err?.status || err.status >= 500) return { kind: "uncertain", message: "" };
  return { kind: "rejected", message };
}

/** Une la respuesta de una tanda al acumulado (filas por cliente y avisos). */
export function mergeBatchResponse(
  acc: { rows: ResultRow[]; warnings: string[] },
  res: EmitResponse,
): { rows: ResultRow[]; warnings: string[] } {
  const warnings = [...acc.warnings];
  for (const w of res.warnings ?? []) if (!warnings.includes(w)) warnings.push(w);
  return { rows: [...acc.rows, ...toResultRows(res)], warnings };
}

export interface BatchProgress {
  doneClients: number;
  totalClients: number;
  doneBatches: number;
  totalBatches: number;
  percent: number;
}

/** Progreso: `doneBatches` tandas completadas de `batches`. */
export function computeProgress(
  batches: number[][],
  doneBatches: number,
): BatchProgress {
  const totalClients = batches.reduce((s, b) => s + b.length, 0);
  const d = Math.max(0, Math.min(doneBatches, batches.length));
  const doneClients = batches.slice(0, d).reduce((s, b) => s + b.length, 0);
  return {
    doneClients,
    totalClients,
    doneBatches: d,
    totalBatches: batches.length,
    percent: totalClients === 0 ? 0 : Math.round((doneClients / totalClients) * 100),
  };
}

export type RunStop = "none" | "user" | BatchFailureKind;

export interface RunOutcome {
  rows: ResultRow[];
  warnings: string[];
  /** Índices (0-based) de tandas completadas con respuesta 200. */
  completed: number[];
  /** Tanda cuyo resultado se desconoce (corte/5xx), si la hay. */
  uncertain: number | null;
  /** Tanda rechazada con certeza (nada emitido en ella), si la hay. */
  rejected: number | null;
  /** Tandas que no se llegaron a enviar. */
  notSent: number[];
  stop: RunStop;
  failureMessage: string;
  /** True si se envió al menos una tanda (completada o incierta). */
  anySent: boolean;
}

export interface RunOptions {
  batches: number[][];
  /** Envía UNA tanda. Debe lanzar con status/errorCode si el servidor falla. */
  send: (clientIds: number[], index: number) => Promise<EmitResponse>;
  /** Se consulta antes de cada tanda (parada tras la tanda en curso). */
  shouldStop?: () => boolean;
  onProgress?: (p: BatchProgress, index: number) => void;
}

/** Ejecuta las tandas en secuencia aplicando las reglas de seguridad. */
export async function runBatches(opts: RunOptions): Promise<RunOutcome> {
  const { batches, send, shouldStop, onProgress } = opts;
  let acc = { rows: [] as ResultRow[], warnings: [] as string[] };
  const out: RunOutcome = {
    rows: [],
    warnings: [],
    completed: [],
    uncertain: null,
    rejected: null,
    notSent: [],
    stop: "none",
    failureMessage: "",
    anySent: false,
  };
  const rest = (from: number): number[] =>
    batches.map((_, i) => i).filter((i) => i >= from);

  onProgress?.(computeProgress(batches, 0), -1);
  for (let i = 0; i < batches.length; i++) {
    if (shouldStop?.()) {
      out.stop = "user";
      out.notSent = rest(i);
      break;
    }
    out.anySent = true;
    try {
      const res = await send(batches[i], i);
      acc = mergeBatchResponse(acc, res);
      out.completed.push(i);
      onProgress?.(computeProgress(batches, out.completed.length), i);
    } catch (e) {
      const f = classifyBatchFailure(e);
      out.stop = f.kind;
      out.failureMessage = f.message;
      if (f.kind === "uncertain") out.uncertain = i;
      else {
        out.rejected = i;
        out.anySent = out.completed.length > 0;
      }
      out.notSent = rest(i + 1);
      break;
    }
  }
  out.rows = acc.rows;
  out.warnings = acc.warnings;
  return out;
}
