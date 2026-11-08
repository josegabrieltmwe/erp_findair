import { http } from "./http";

/**
 * POST /api_cargo_tact_update sin retener el BFF (PLAN_MIGRACION_RPC_DEMONIO.md R2, contrato P113): se pide con
 * `async: true`; si el API lo encarga al demonio responde `{data: {status: "waiting", request_id}}` y aquí se consulta
 * GET /api_cargo_tact_state hasta tener la misma respuesta (o el mismo error HTTP) que daría el POST síncrono. Sin
 * interruptor o demonio el API responde directamente y esto no cambia nada.
 */
const STATE = "/api_cargo_tact_state";
/** El API da la consulta por vencida a los 45 s. */
const MAX_WAIT_MS = 50_000;

interface Queued {
  status: "waiting";
  request_id: number;
  poll_after_ms?: number;
}

function queuedOf(raw: unknown): Queued | null {
  const d = (raw as { data?: Partial<Queued> } | null)?.data;
  return d && d.status === "waiting" && typeof d.request_id === "number" ? (d as Queued) : null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function requestTact<T>(body: Record<string, unknown>): Promise<T> {
  let raw = await http<T>("/api_cargo_tact_update", { method: "POST", body: { ...body, async: true } });
  const started = Date.now();
  for (let q = queuedOf(raw); q; q = queuedOf(raw)) {
    if (Date.now() - started > MAX_WAIT_MS) throw new Error("TACT did not answer in time");
    await sleep(Math.max(500, q.poll_after_ms ?? 1000));
    raw = await http<T>(STATE, { method: "GET", query: { request_id: q.request_id } });
  }
  return raw;
}
