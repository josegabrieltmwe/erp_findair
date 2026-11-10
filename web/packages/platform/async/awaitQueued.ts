import { cancelAsyncRequest } from "./asyncRequest";

/**
 * Espera de una operación que el API encargó a su demonio (PLAN_MIGRACION_RPC_DEMONIO.md R2): la primera respuesta
 * llega como `{data: {status: "waiting", request_id, poll_after_ms}}` (o sin `data`) y se consulta el estado con
 * `poll(request_id)` hasta tener la respuesta de siempre. Si la primera respuesta ya es la definitiva (sin interruptor
 * o sin demonio en el API), se devuelve tal cual.
 */
export interface QueuedOperation {
  status: "waiting";
  request_id: number;
  poll_after_ms?: number;
}

export function queuedOf(raw: unknown): QueuedOperation | null {
  const r = raw as { data?: unknown } | null;
  const d = (r && typeof r === "object" && "data" in r ? r.data : r) as Partial<QueuedOperation> | null;
  return d && typeof d === "object" && d.status === "waiting" && typeof d.request_id === "number"
    ? (d as QueuedOperation)
    : null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface AwaitQueuedOptions {
  /** Al abortar se deja de esperar, se cancela la petición en el API (si es una lectura) y se lanza AbortError. */
  signal?: AbortSignal;
  /** Cancelación en el API; por defecto la común (cancelAsyncRequest). */
  cancel?: (requestId: number) => Promise<unknown>;
  /** Cada vez que se consulta y sigue en curso (para mostrar que se espera). */
  onWaiting?: (requestId: number) => void;
}

function abortError(): Error {
  const e = new Error("Aborted");
  e.name = "AbortError";
  return e;
}

export async function awaitQueued<T>(
  first: T,
  poll: (requestId: number) => Promise<T>,
  maxWaitMs = 130_000,
  opts: AwaitQueuedOptions = {},
): Promise<T> {
  const started = Date.now();
  let raw = first;
  for (let q = queuedOf(raw); q; q = queuedOf(raw)) {
    if (opts.signal?.aborted) {
      await (opts.cancel ?? cancelAsyncRequest)(q.request_id).catch(() => undefined);
      throw abortError();
    }
    if (Date.now() - started > maxWaitMs) throw new Error("The operation did not finish in time");
    opts.onWaiting?.(q.request_id);
    await sleep(Math.max(500, q.poll_after_ms ?? 1000));
    if (opts.signal?.aborted) {
      await (opts.cancel ?? cancelAsyncRequest)(q.request_id).catch(() => undefined);
      throw abortError();
    }
    raw = await poll(q.request_id);
  }
  return raw;
}
