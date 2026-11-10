import { describe, expect, it, vi } from "vitest";

const httpMock = vi.fn();
vi.mock("@shared/anagrafiche/services/http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));
vi.mock("../../../packages/platform/anagrafiche/services/http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));

import { awaitQueued, queuedOf } from "@shared/async/awaitQueued";
import { cancelAsyncRequest, fetchAsyncRequest } from "@shared/async/asyncRequest";

// R3 de PLAN_MIGRACION_RPC_DEMONIO.md: cliente común de las peticiones encargadas al demonio del API.
describe("awaitQueued", () => {
  it("reconoce la respuesta en curso con o sin data", () => {
    expect(queuedOf({ data: { status: "waiting", request_id: 4 } })?.request_id).toBe(4);
    expect(queuedOf({ status: "waiting", request_id: 5 })?.request_id).toBe(5);
    expect(queuedOf({ data: { file: "x" } })).toBeNull();
  });

  it("consulta hasta tener la respuesta y avisa mientras espera", async () => {
    vi.useFakeTimers();
    const poll = vi.fn()
      .mockResolvedValueOnce({ data: { status: "waiting", request_id: 9 } })
      .mockResolvedValueOnce({ data: { file: "QQ==" } });
    const waiting: number[] = [];
    const p = awaitQueued({ data: { status: "waiting", request_id: 9, poll_after_ms: 500 } }, poll, 60_000, { onWaiting: (id) => waiting.push(id) });
    await vi.runAllTimersAsync();
    expect(await p).toEqual({ data: { file: "QQ==" } });
    expect(poll).toHaveBeenCalledTimes(2);
    expect(waiting).toEqual([9, 9]);
    vi.useRealTimers();
  });

  it("al abortar cancela la petición en el API y lanza AbortError", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const cancel = vi.fn().mockResolvedValue(true);
    await expect(awaitQueued({ data: { status: "waiting", request_id: 9 } }, vi.fn(), 60_000, { signal: ctrl.signal, cancel }))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledWith(9);
  });
});

describe("asyncRequest", () => {
  it("usa la ruta común para el estado y para cancelar", async () => {
    httpMock.mockResolvedValueOnce({ request_id: 3, status: "waiting" }).mockResolvedValueOnce({ cancelled: true });
    await fetchAsyncRequest(3, 7);
    expect(await cancelAsyncRequest(3)).toBe(true);
    expect(httpMock.mock.calls[0]).toEqual(["/api_async_request", { method: "GET", query: { request_id: 3, since: 7 } }]);
    expect(httpMock.mock.calls[1]).toEqual(["/api_async_request", { method: "POST", body: { request_id: 3, op: "cancel" } }]);
  });
});
