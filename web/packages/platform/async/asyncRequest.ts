import { http } from "../anagrafiche/services/http";

/**
 * Estado común de una petición encargada al demonio del API (PLAN_MIGRACION_RPC_DEMONIO.md R3, contrato P115):
 * estado, progreso, eventos públicos y cancelación. El resultado lo da la ruta de cada operación (awaitQueued).
 */
export interface AsyncRequestState {
  request_id: number;
  kind: string;
  status: "waiting" | "done" | "failed" | "expired" | "cancelled";
  progress: { received: number; expected: number; round?: number } | null;
  events: { seq: number; event: string; data: Record<string, unknown> }[];
  cursor: number;
  cancellable: boolean;
  error_code: string | null;
  poll_after_ms?: number;
}

const ROUTE = "/api_async_request";

export async function fetchAsyncRequest(requestId: number, since = 0): Promise<AsyncRequestState> {
  return http<AsyncRequestState>(ROUTE, { method: "GET", query: { request_id: requestId, since } });
}

/** Cancela una lectura en curso. false si ya había terminado; error 409 si el tipo no se puede cancelar. */
export async function cancelAsyncRequest(requestId: number): Promise<boolean> {
  const r = await http<{ cancelled?: boolean }>(ROUTE, { method: "POST", body: { request_id: requestId, op: "cancel" } });
  return !!r?.cancelled;
}
