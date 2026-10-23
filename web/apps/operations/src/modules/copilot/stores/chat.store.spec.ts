import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ApiError } from "@shared/anagrafiche/services/api.types";

const httpMock = vi.fn();
vi.mock("@shared/anagrafiche/services/http", () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

import { normalizeLocale, useChatStore } from "./chat.store";
import { rawCancel, rawProposal } from "../services/fixtures";

const ok = (extra: Record<string, unknown> = {}) => ({
  answer: "He preparado una propuesta.",
  actions: [],
  proposals: [],
  provider: "openai",
  tools_used: [],
  ...extra,
});

async function storeWithProposal(raw: Record<string, unknown> = rawProposal()) {
  httpMock.mockResolvedValueOnce(ok({ proposals: [raw] }));
  const store = useChatStore();
  await store.send("crea una expedicion");
  const bubble = store.bubbles.at(-1)!;
  return { store, bubble };
}

describe("contexto de copilot_chat", () => {
  beforeEach(() => {
    httpMock.mockReset();
    setActivePinia(createPinia());
  });

  it("envia context.locale normalizado y context.current_route", async () => {
    httpMock.mockResolvedValue(ok());
    await useChatStore().send("hola", {
      locale: "it-IT",
      currentRoute: "/shipment/list",
    });
    const body = httpMock.mock.calls[0][1].body;
    expect(body.context).toEqual({
      locale: "it",
      current_route: "/shipment/list",
    });
  });

  it("omite el locale si no es uno de los cinco", async () => {
    httpMock.mockResolvedValue(ok());
    await useChatStore().send("hola", { locale: "fr", currentRoute: "/x" });
    expect(httpMock.mock.calls[0][1].body.context).toEqual({
      current_route: "/x",
    });
    expect(normalizeLocale("NL")).toBe("nl");
    expect(normalizeLocale(undefined)).toBeUndefined();
  });

  it("el historial solo lleva turnos user/assistant de texto", async () => {
    const seen: Array<Array<{ role: string }>> = [];
    httpMock.mockImplementation(
      (_u: string, o: { body: { history: Array<{ role: string }> } }) => {
        seen.push(JSON.parse(JSON.stringify(o.body.history)));
        return Promise.resolve(
          ok({ conversation: [{ role: "tool", content: "x" }] }),
        );
      },
    );
    const store = useChatStore();
    await store.send("uno");
    await store.send("dos");
    expect(seen[0]).toEqual([]);
    expect(seen[1].map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("el texto de la respuesta se guarda como cadena plana", async () => {
    httpMock.mockResolvedValue(
      ok({ answer: "<img src=x onerror=alert(1)> [x](http://evil)" }),
    );
    const store = useChatStore();
    await store.send("hola");
    expect(store.bubbles.at(-1)!.text).toBe(
      "<img src=x onerror=alert(1)> [x](http://evil)",
    );
  });

  it("limites del BFF se traducen a claves i18n", async () => {
    const store = useChatStore();
    httpMock.mockRejectedValueOnce(
      new ApiError("x", 429, "RATE_LIMIT", { code: "concurrency_limited" }),
    );
    await store.send("a");
    expect(store.bubbles.at(-1)!.errorKey).toBe("copilot.errors.busy");
    httpMock.mockRejectedValueOnce(
      new ApiError("x", 429, "RATE_LIMIT", { code: "rate_limited" }),
    );
    await store.send("b");
    expect(store.bubbles.at(-1)!.errorKey).toBe("copilot.errors.rate_limited");
    httpMock.mockRejectedValueOnce(
      new ApiError("x", 403, "FORBIDDEN", { code: "AI_FORBIDDEN" }),
    );
    await store.send("c");
    expect(store.bubbles.at(-1)!.errorKey).toBe("copilot.errors.disabled");
  });

  it.each([
    ["AI_CREDENTIALS_INVALID", 503, "copilot.errors.ai_not_configured"],
    ["AI_CREDENTIALS_MISSING", 503, "copilot.errors.ai_not_configured"],
    ["AI_UNAVAILABLE", 503, "copilot.errors.ai_unavailable"],
    ["AI_TIMEOUT", 504, "copilot.errors.ai_unavailable"],
    ["AI_PROVIDER_ERROR", 502, "copilot.errors.ai_unavailable"],
    ["AI_PROTOCOL_UNSUPPORTED", 502, "copilot.errors.ai_unavailable"],
    ["AI_BAD_REQUEST", 400, "copilot.errors.ai_unavailable"],
    ["AI_BUDGET_EXCEEDED", 429, "copilot.errors.ai_budget"],
  ])("codigo %s (%i) se traduce a %s", async (code, status, key) => {
    httpMock.mockRejectedValueOnce(new ApiError("x", status, "X", { code }));
    const store = useChatStore();
    await store.send("a");
    const bubble = store.bubbles.at(-1)!;
    expect(bubble.error).toBe(true);
    expect(bubble.errorKey).toBe(key);
  });

  it("AI_BUDGET_EXCEEDED gana al 429 generico (rate_limited)", async () => {
    httpMock.mockRejectedValueOnce(
      new ApiError("x", 429, "RATE_LIMIT", {
        code: "AI_BUDGET_EXCEEDED",
        error_code: "AI_BUDGET_EXCEEDED",
      }),
    );
    const store = useChatStore();
    await store.send("a");
    expect(store.bubbles.at(-1)!.errorKey).toBe("copilot.errors.ai_budget");
  });

  it("un 503/502 sin codigo conocido no inventa mensaje de IA", async () => {
    httpMock.mockRejectedValueOnce(
      new ApiError("x", 502, "X", { code: "upstream_error" }),
    );
    const store = useChatStore();
    await store.send("a");
    expect(store.bubbles.at(-1)!.errorKey).toBeUndefined();
  });

  it("navega con el router por nombre de ruta", async () => {
    vi.useFakeTimers();
    const push = vi.fn().mockResolvedValue(undefined);
    httpMock.mockResolvedValue(
      ok({
        actions: [
          { type: "navigate", route: "tracking", path: "/erp/tmwe_json/x" },
        ],
      }),
    );
    await useChatStore().send("ve a tracking", {
      router: { push, hasRoute: () => true },
    });
    vi.advanceTimersByTime(700);
    expect(push).toHaveBeenCalledWith({ name: "tracking" });
    vi.useRealTimers();
  });
});

describe("propuestas y confirmacion", () => {
  beforeEach(() => {
    httpMock.mockReset();
    setActivePinia(createPinia());
  });

  it("pinta la tarjeta solo si el descriptor es valido", async () => {
    const { bubble } = await storeWithProposal();
    expect(bubble.proposal?.status).toBe("pending");
    expect(bubble.proposal?.proposal.draft).toBe(true);

    httpMock.mockResolvedValueOnce(
      ok({ proposals: [{ type: "confirm_proposal", token: "x" }] }),
    );
    const store = useChatStore();
    await store.send("otra");
    expect(store.bubbles.at(-1)!.proposal).toBeUndefined();
  });

  it("confirmar envia op, token y payload_override identico al recibido", async () => {
    const raw = rawProposal();
    const expectedJson = JSON.stringify(raw.payload);
    const { store, bubble } = await storeWithProposal(raw);
    httpMock.mockResolvedValueOnce({
      success: true,
      executed: true,
      result: { success: true, http_status: 201, data: { data: { id: 321 } } },
      readback: { status: "verified" },
    });
    await store.confirm(bubble.id);

    const [url, options] = httpMock.mock.calls[1];
    expect(url).toBe("/api_copilot_write_proposal");
    expect(options.body.op).toBe("confirmar");
    expect(JSON.stringify(options.body.payload_override)).toBe(expectedJson);
    expect(bubble.proposal?.status).toBe("verified");
    expect(bubble.proposal?.outcome?.createdId).toBe(321);
  });

  it("doble clic: solo una peticion mientras confirma y ninguna despues de terminar", async () => {
    const { store, bubble } = await storeWithProposal();
    let release!: (v: unknown) => void;
    httpMock.mockReturnValueOnce(new Promise((r) => (release = r)));
    const first = store.confirm(bubble.id);
    await store.confirm(bubble.id);
    expect(httpMock).toHaveBeenCalledTimes(2); // chat + 1 confirmacion
    release({
      success: true,
      executed: true,
      readback: { status: "verified" },
    });
    await first;
    await store.confirm(bubble.id);
    expect(httpMock).toHaveBeenCalledTimes(2);
  });

  it("executed:false NO es confirmado y muestra el motivo real", async () => {
    const { store, bubble } = await storeWithProposal();
    httpMock.mockResolvedValueOnce({
      success: true,
      executed: false,
      result: { success: false, http_status: 422, error: "solo el mismo día" },
    });
    await store.confirm(bubble.id);
    expect(bubble.proposal?.status).toBe("rejected");
    expect(bubble.proposal?.outcome?.error).toBe("solo el mismo día");
  });

  it.each(["mismatch", "unverified"])(
    "readback %s NO es verificado",
    async (status) => {
      const { store, bubble } = await storeWithProposal();
      httpMock.mockResolvedValueOnce({
        success: true,
        executed: true,
        result: { success: true },
        readback: { status, not_compared: ["pickup_date"] },
      });
      await store.confirm(bubble.id);
      expect(bubble.proposal?.status).toBe(status);
      expect(bubble.proposal?.status).not.toBe("verified");
    },
  );

  it("409 payload_mismatch: error claro, no reintentable", async () => {
    const { store, bubble } = await storeWithProposal();
    httpMock.mockRejectedValueOnce(
      new ApiError("payload_mismatch", 409, undefined, {
        code: "payload_mismatch",
        success: false,
      }),
    );
    await store.confirm(bubble.id);
    expect(bubble.proposal).toMatchObject({
      status: "error",
      errorKind: "payload_mismatch",
      retryable: false,
    });
    await store.confirm(bubble.id);
    expect(httpMock).toHaveBeenCalledTimes(2);
  });

  it("403 operator_mismatch y 409 expired / already_executed", async () => {
    for (const [status, code, kind] of [
      [403, "operator_mismatch", "operator_mismatch"],
      [409, "expired", "expired"],
      [409, "already_executed_or_failed", "already_executed"],
    ] as const) {
      setActivePinia(createPinia());
      httpMock.mockReset();
      const { store, bubble } = await storeWithProposal();
      httpMock.mockRejectedValueOnce(
        new ApiError(code, status, undefined, { code }),
      );
      await store.confirm(bubble.id);
      expect(bubble.proposal?.errorKind).toBe(kind);
      expect(bubble.proposal?.retryable).toBe(false);
    }
  });

  it("rechazo previo del BFF (sin llegar al ERP) permite reintentar y el reintento funciona", async () => {
    const { store, bubble } = await storeWithProposal();
    httpMock.mockRejectedValueOnce(
      new ApiError("x", 503, "SERVER_ERROR", { code: "capacity_exceeded" }),
    );
    await store.confirm(bubble.id);
    expect(bubble.proposal).toMatchObject({
      status: "error",
      errorKind: "unavailable",
      retryable: true,
    });
    httpMock.mockResolvedValueOnce({
      success: true,
      executed: true,
      readback: { status: "verified" },
    });
    await store.confirm(bubble.id);
    expect(bubble.proposal?.status).toBe("verified");
  });

  it("fallo de red o 5xx al confirmar: resultado incierto, sin reintento ni segunda llamada", async () => {
    const { store, bubble } = await storeWithProposal();
    httpMock.mockRejectedValueOnce(
      new ApiError("x", 502, "SERVER_ERROR", { code: "upstream_error" }),
    );
    await store.confirm(bubble.id);
    expect(bubble.proposal).toMatchObject({
      status: "error",
      errorKind: "uncertain",
      retryable: false,
    });
    const calls = httpMock.mock.calls.length;
    await store.confirm(bubble.id);
    expect(httpMock.mock.calls.length).toBe(calls);
  });

  it("caducada en el cliente: no llama al backend", async () => {
    const { store, bubble } = await storeWithProposal();
    const later = bubble.proposal!.receivedAt + 301_000;
    await store.confirm(bubble.id, false, () => later);
    expect(bubble.proposal).toMatchObject({
      status: "error",
      errorKind: "expired",
    });
    expect(httpMock).toHaveBeenCalledTimes(1);
  });

  it("cancel (reforzada) exige el segundo gesto", async () => {
    const { store, bubble } = await storeWithProposal(rawCancel());
    await store.confirm(bubble.id, false);
    expect(httpMock).toHaveBeenCalledTimes(1);
    expect(bubble.proposal?.status).toBe("pending");
    httpMock.mockResolvedValueOnce({
      success: true,
      executed: true,
      readback: { status: "verified" },
    });
    await store.confirm(bubble.id, true);
    expect(httpMock).toHaveBeenCalledTimes(2);
  });

  it("descartar es local: no hay llamada y no se puede confirmar despues", async () => {
    const { store, bubble } = await storeWithProposal();
    store.dismiss(bubble.id);
    expect(bubble.proposal?.status).toBe("dismissed");
    await store.confirm(bubble.id);
    expect(httpMock).toHaveBeenCalledTimes(1);
  });

  it("no se descarta una confirmacion en vuelo", async () => {
    const { store, bubble } = await storeWithProposal();
    httpMock.mockReturnValueOnce(new Promise(() => undefined));
    void store.confirm(bubble.id);
    store.dismiss(bubble.id);
    expect(bubble.proposal?.status).toBe("confirming");
  });

  it("el payload recibido es inmutable", async () => {
    const { bubble } = await storeWithProposal();
    const payload = bubble.proposal!.proposal.payload as Record<
      string,
      unknown
    >;
    expect(() => {
      "use strict";
      (payload as { destination: unknown }).destination = null;
    }).toThrow();
  });
});
