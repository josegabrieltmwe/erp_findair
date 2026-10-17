import { beforeEach, describe, expect, it, vi } from "vitest";

const httpMock = vi.fn();
vi.mock("@shared/anagrafiche/services/http", () => ({
  http: (...a: unknown[]) => httpMock(...a),
}));

import {
  buildQueueQuery,
  consolidataService,
  ConsolidataRequestError,
  shipmentPayload,
} from "./services/consolidata.service";
import { emptyQueueFilters, type ShipmentForm } from "./types";

beforeEach(() => {
  httpMock.mockReset();
});

describe("buildQueueQuery", () => {
  it("por defecto pide la bandeja de P", () => {
    expect(buildQueueQuery(emptyQueueFilters(), 1)).toEqual({
      view: "queue",
      page: 1,
      stato: "P",
    });
  });
  it("añade asignación y cliente solo si hay valor", () => {
    expect(
      buildQueueQuery({ stato: "", assegnato_a: "me", id_cliente: 9 }, 3),
    ).toEqual({
      view: "queue",
      page: 3,
      stato: "",
      assegnato_a: "me",
      id_cliente: 9,
    });
  });
});

describe("shipmentPayload", () => {
  it("normaliza y omite campos vacíos", () => {
    const f: ShipmentForm = {
      ref: " H1 ",
      orig_paese: "it",
      orig_cap: "20100",
      orig_citta: "Milano",
      orig_terminal: "",
      peso: 10,
      colli: 2,
      volume_cm3: null,
      valore: null,
      merce: "",
      data_pronta: "",
      id_spedizione: null,
    };
    expect(shipmentPayload(f)).toEqual({
      ref: "H1",
      orig_paese: "IT",
      orig_cap: "20100",
      orig_citta: "Milano",
      peso: 10,
      colli: 2,
    });
  });
});

describe("consolidataService", () => {
  it("devuelve result si success", async () => {
    httpMock.mockResolvedValue({ success: true, result: { id: 5 } });
    await expect(consolidataService.detail(5)).resolves.toEqual({ id: 5 });
    expect(httpMock).toHaveBeenCalledWith("/unified_consolidation_project", {
      method: "GET",
      query: { id: 5 },
    });
  });

  it("las acciones POST envían {action, ...}", async () => {
    httpMock.mockResolvedValue({ success: true, result: {} });
    await consolidataService.answerQuote(7, { prezzo: 100, nota: "ok" });
    expect(httpMock).toHaveBeenCalledWith("/unified_consolidation_project", {
      method: "POST",
      body: { action: "answer_quote", id: 7, prezzo: 100, nota: "ok" },
    });
    await consolidataService.convert(7, 33);
    expect(httpMock).toHaveBeenLastCalledWith(
      "/unified_consolidation_project",
      {
        method: "POST",
        body: { action: "convert", id: 7, id_cargo: 33 },
      },
    );
  });

  it("un error HTTP del API sale como ConsolidataRequestError normalizado", async () => {
    httpMock.mockRejectedValue({
      message: "Request failed",
      status: 409,
      details: {
        success: false,
        error: "gia assegnato",
        code: "already_assigned",
        details: { assegnato_a: 3 },
      },
    });
    try {
      await consolidataService.take(1);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConsolidataRequestError);
      expect((err as ConsolidataRequestError).info.code).toBe(
        "already_assigned",
      );
      expect((err as ConsolidataRequestError).info.status).toBe(409);
    }
  });

  it("una respuesta {success:false} con HTTP 200 también es error", async () => {
    httpMock.mockResolvedValue({
      success: false,
      error: "x",
      code: "NOT_FOUND",
    });
    try {
      await consolidataService.detail(1);
      expect.unreachable();
    } catch (err) {
      expect((err as ConsolidataRequestError).info.code).toBe("NOT_FOUND");
    }
  });
});
