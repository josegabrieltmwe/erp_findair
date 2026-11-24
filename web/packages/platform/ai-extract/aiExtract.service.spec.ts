import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../anagrafiche/services/api.types";

const httpMock = vi.fn();
vi.mock("../anagrafiche/services/http", () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

import { AiExtractError, extractShipment } from "./aiExtract.service";

describe("extractShipment", () => {
  beforeEach(() => {
    httpMock.mockReset();
  });

  it("envía el texto con extraction_mode y devuelve los campos extraídos", async () => {
    httpMock.mockResolvedValueOnce({
      extracted_data: { destination: { city: "Milano" } },
      confidence: 0.9,
      warnings: ["peso aproximado"],
    });

    const result = await extractShipment({ mode: "express", text: "manda 3 bultos a Milano" });

    const [url, options] = httpMock.mock.calls[0];
    expect(url).toBe("/api_ai_extract");
    expect(options.method).toBe("POST");
    expect(options.body).toMatchObject({ extraction_mode: "express", text: "manda 3 bultos a Milano" });
    expect(options.body.content).toBeUndefined();
    expect(result.extracted).toEqual({ destination: { city: "Milano" } });
    expect(result.confidence).toBe(0.9);
    expect(result.warnings).toEqual(["peso aproximado"]);
  });

  it("envía un fichero como content/mime_type/filename, sin texto", async () => {
    httpMock.mockResolvedValueOnce({ extracted_data: { parcels: { count: 3 } } });

    await extractShipment({
      mode: "cargo",
      file: { content: "QQ==", mimeType: "image/png", filename: "etiqueta.png" },
    });

    const [, options] = httpMock.mock.calls[0];
    expect(options.body).toMatchObject({
      extraction_mode: "cargo",
      content: "QQ==",
      mime_type: "image/png",
      filename: "etiqueta.png",
    });
    expect(options.body.text).toBeUndefined();
  });

  it("si la respuesta inicial es 202 waiting, hace polling a api_ai_extract_status hasta done", async () => {
    vi.useFakeTimers();
    httpMock
      .mockResolvedValueOnce({ status: "waiting", request_id: 42, poll_after_ms: 100 })
      .mockResolvedValueOnce({ status: "running", request_id: 42 })
      .mockResolvedValueOnce({
        status: "done",
        request_id: 42,
        result: { extracted_data: { destination: { city: "Roma" } } },
      });

    const p = extractShipment({ mode: "express", text: "x" });
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result.extracted).toEqual({ destination: { city: "Roma" } });
    expect(httpMock).toHaveBeenCalledTimes(3);
    expect(httpMock.mock.calls[1][0]).toBe("/api_ai_extract_status");
    expect(httpMock.mock.calls[1][1].query).toEqual({ request_id: 42 });
    vi.useRealTimers();
  });

  it("clasifica un 429 como presupuesto agotado", async () => {
    httpMock.mockRejectedValueOnce(new ApiError("budget", 429, "AI_BUDGET_EXCEEDED"));
    await expect(extractShipment({ mode: "express", text: "x" })).rejects.toMatchObject({
      kind: "budget_exhausted",
    });
  });

  it("clasifica un 503/504 como no disponible", async () => {
    httpMock.mockRejectedValueOnce(new ApiError("no consumer", 503));
    await expect(extractShipment({ mode: "express", text: "x" })).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("si la extracción no devuelve ningún campo, lanza no_data en vez de un resultado vacío", async () => {
    httpMock.mockResolvedValueOnce({ extracted_data: {} });
    await expect(extractShipment({ mode: "express", text: "x" })).rejects.toMatchObject({
      kind: "no_data",
    });
  });

  it("sin texto ni fichero, lanza no_data sin llamar al backend", async () => {
    await expect(extractShipment({ mode: "express" })).rejects.toBeInstanceOf(AiExtractError);
    expect(httpMock).not.toHaveBeenCalled();
  });
});
