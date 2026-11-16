import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fuera de un componente: el composable registra onUnmounted, aquí se llama a stop() a mano.
vi.mock("vue", async (orig) => ({ ...(await orig<typeof import("vue")>()), onUnmounted: () => {} }));

const pollEvents = vi.fn();
vi.mock("../services/communication.service", () => ({
  communicationService: { pollEvents: (...a: unknown[]) => pollEvents(...a) },
}));

import { POLL_FALLBACK_MS, useCommStream } from "./useCommStream";

function okResult(overrides: Partial<{ cursor: number; reset: boolean; events: unknown[] }> = {}) {
  return { cursor: 0, reset: false, events: [], user_id: 42, ...overrides };
}

// Este spec es de lógica pura (entorno "node", sin DOM, convención del repo): el composable solo
// lee `document.visibilityState` a través de un `typeof document !== "undefined"` — aquí se
// stubea esa única propiedad en vez de arrastrar happy-dom para esto.
const fakeDocument = { visibilityState: "visible" as "visible" | "hidden" };

describe("useCommStream (sondeo, collaudo 16/11 N57)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pollEvents.mockReset();
    fakeDocument.visibilityState = "visible";
    vi.stubGlobal("document", fakeDocument);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sondea de inmediato al arrancar, sin cursor", async () => {
    pollEvents.mockResolvedValue(okResult());
    const s = useCommStream({});
    await s.start();
    expect(pollEvents).toHaveBeenCalledWith(undefined);
    expect(s.connected.value).toBe(true);
    s.stop();
  });

  it("encadena el cursor devuelto al siguiente sondeo", async () => {
    pollEvents.mockResolvedValueOnce(okResult({ cursor: 7 }));
    const s = useCommStream({});
    await s.start();
    pollEvents.mockResolvedValueOnce(okResult({ cursor: 9 }));
    await vi.advanceTimersByTimeAsync(4000);
    expect(pollEvents).toHaveBeenLastCalledWith(7);
    s.stop();
  });

  it("reparte cada evento a su manejador segun el tipo", async () => {
    const onMessageCreated = vi.fn();
    const onUnreadChanged = vi.fn();
    const onConversationClosed = vi.fn();
    pollEvents.mockResolvedValue(
      okResult({
        events: [
          { id: 1, event: "message.created", data: { conversation_id: "ticket:1" } },
          { id: 2, event: "unread.changed", data: { conversation_id: "ticket:1", unread_count: 1, unread_total: 1 } },
          { id: 3, event: "conversation.closed", data: { conversation_id: "ticket:1" } },
          { id: 4, event: "something.unknown", data: {} },
        ],
      }),
    );
    const s = useCommStream({ onMessageCreated, onUnreadChanged, onConversationClosed });
    await s.start();
    expect(onMessageCreated).toHaveBeenCalledWith({ conversation_id: "ticket:1" });
    expect(onUnreadChanged).toHaveBeenCalledWith({ conversation_id: "ticket:1", unread_count: 1, unread_total: 1 });
    expect(onConversationClosed).toHaveBeenCalledWith({ conversation_id: "ticket:1" });
    s.stop();
  });

  it("reset:true olvida el cursor y dispara poll en vez de repartir eventos", async () => {
    pollEvents.mockResolvedValueOnce(okResult({ cursor: 5 }));
    const poll = vi.fn();
    const s = useCommStream({ poll });
    await s.start();

    pollEvents.mockResolvedValueOnce(okResult({ cursor: 99, reset: true }));
    await vi.advanceTimersByTimeAsync(4000);
    expect(poll).toHaveBeenCalledTimes(1);

    // El siguiente sondeo usa el cursor nuevo, no insiste con el viejo.
    pollEvents.mockResolvedValueOnce(okResult({ cursor: 100 }));
    await vi.advanceTimersByTimeAsync(4000);
    expect(pollEvents).toHaveBeenLastCalledWith(99);
    s.stop();
  });

  it("un fallo pasajero no rompe el sondeo: el siguiente tick reintenta sin backoff", async () => {
    pollEvents.mockRejectedValueOnce(new Error("network"));
    const s = useCommStream({});
    await s.start();
    expect(s.connected.value).toBe(false);

    pollEvents.mockResolvedValueOnce(okResult());
    await vi.advanceTimersByTimeAsync(4000);
    expect(s.connected.value).toBe(true);
    expect(pollEvents).toHaveBeenCalledTimes(2);
    s.stop();
  });

  it("con la pestaña oculta no sondea; al volver visible retoma", async () => {
    pollEvents.mockResolvedValue(okResult());
    const s = useCommStream({});
    await s.start();
    pollEvents.mockClear();

    fakeDocument.visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(4000 * 3);
    expect(pollEvents).not.toHaveBeenCalled();

    fakeDocument.visibilityState = "visible";
    await vi.advanceTimersByTimeAsync(4000);
    expect(pollEvents).toHaveBeenCalledTimes(1);
    s.stop();
  });

  it("stop() detiene el sondeo y el refresco de respaldo", async () => {
    pollEvents.mockResolvedValue(okResult());
    const poll = vi.fn();
    const s = useCommStream({ poll });
    await s.start();
    s.stop();
    pollEvents.mockClear();

    await vi.advanceTimersByTimeAsync(POLL_FALLBACK_MS * 2);
    expect(pollEvents).not.toHaveBeenCalled();
    expect(poll).not.toHaveBeenCalled();
  });

  it("el refresco de respaldo llama a poll cada POLL_FALLBACK_MS mientras la pestaña está visible", async () => {
    pollEvents.mockResolvedValue(okResult());
    const poll = vi.fn();
    const s = useCommStream({ poll });
    await s.start();

    await vi.advanceTimersByTimeAsync(POLL_FALLBACK_MS * 2);
    expect(poll).toHaveBeenCalledTimes(2);
    s.stop();
  });
});
