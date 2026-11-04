import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fuera de un componente: el composable registra onUnmounted, aquí se llama a stop() a mano.
vi.mock("vue", async (orig) => ({ ...(await orig<typeof import("vue")>()), onUnmounted: () => {} }));

const issueStreamToken = vi.fn();
vi.mock("../services/communication.service", () => ({
  communicationService: { issueStreamToken: (...a: unknown[]) => issueStreamToken(...a) },
}));

import { POLL_FALLBACK_MS, isRealtimeUnavailable, useCommStream } from "./useCommStream";

/** Sin tiempo real en el servidor (501 COMM_NOT_IMPLEMENTED) no se reintenta: se refresca con `poll`. */
describe("useCommStream sin tiempo real en el servidor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    issueStreamToken.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reconoce el 501 por el estado, sea cual sea la clase del error", () => {
    expect(isRealtimeUnavailable({ status: 501, errorCode: "COMM_NOT_IMPLEMENTED" })).toBe(true);
    expect(isRealtimeUnavailable({ status: 502 })).toBe(false);
    expect(isRealtimeUnavailable(new Error("red"))).toBe(false);
  });

  it("501: deja de pedir token y llama a poll cada 30 s hasta stop()", async () => {
    issueStreamToken.mockRejectedValue({ status: 501, errorCode: "COMM_NOT_IMPLEMENTED" });
    const poll = vi.fn();
    const s = useCommStream({ poll });

    await s.start();
    expect(s.realtimeAvailable.value).toBe(false);

    await vi.advanceTimersByTimeAsync(POLL_FALLBACK_MS * 3);
    expect(issueStreamToken).toHaveBeenCalledTimes(1);
    expect(poll).toHaveBeenCalledTimes(3);

    s.stop();
    await vi.advanceTimersByTimeAsync(POLL_FALLBACK_MS * 2);
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it("un fallo pasajero (500) sigue reintentando con un token nuevo y no hace polling", async () => {
    issueStreamToken.mockRejectedValue({ status: 500 });
    const poll = vi.fn();
    const s = useCommStream({ poll });

    await s.start();
    await vi.advanceTimersByTimeAsync(2000);
    expect(issueStreamToken).toHaveBeenCalledTimes(2);
    expect(s.realtimeAvailable.value).toBe(true);
    expect(poll).not.toHaveBeenCalled();
    s.stop();
  });
});
