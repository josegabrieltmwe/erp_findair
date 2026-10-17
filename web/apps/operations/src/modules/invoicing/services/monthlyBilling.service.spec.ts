import { beforeEach, describe, expect, it, vi } from "vitest";

const httpMock = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));

import {
  defaultInvoiceDate,
  buildEmitBody,
  buildPreviewQuery,
  classifyEmitError,
  invalidReasons,
  monthlyBillingApi,
  previousMonthRange,
  selectAllValid,
  toResultRows,
  totalOf,
  validateInvoiceDate,
  type BillingClient,
  type BillingParams,
} from "./monthlyBilling.service";

beforeEach(() => httpMock.mockReset());

const params: BillingParams = {
  dal: "2026-09-01",
  al: "2026-09-30",
  minimo: 10,
  solo_chiusi: true,
  no_giaccrm: true,
  no_cargo: false,
  no_express: false,
};

describe("previousMonthRange", () => {
  it("devuelve el mes natural anterior", () => {
    expect(previousMonthRange(new Date(2026, 9, 4))).toEqual({
      dal: "2026-09-01",
      al: "2026-09-30",
    });
  });
  it("cruza el año y años bisiestos", () => {
    expect(previousMonthRange(new Date(2026, 0, 15))).toEqual({
      dal: "2025-12-01",
      al: "2025-12-31",
    });
    expect(previousMonthRange(new Date(2024, 2, 1))).toEqual({
      dal: "2024-02-01",
      al: "2024-02-29",
    });
  });
});

describe("peticiones", () => {
  it("vista previa: solo manda las marcas activas", () => {
    expect(buildPreviewQuery(params)).toEqual({
      dal: "2026-09-01",
      al: "2026-09-30",
      solo_chiusi: "1",
      no_giaccrm: "1",
      minimo: "10",
    });
    expect(buildPreviewQuery({ ...params, minimo: null })).not.toHaveProperty(
      "minimo",
    );
  });
  it("vista previa: id_cliente solo si hay cliente", () => {
    expect(buildPreviewQuery({ ...params, id_cliente: 42 })).toMatchObject({
      id_cliente: "42",
    });
    expect(buildPreviewQuery({ ...params, id_cliente: null })).not.toHaveProperty(
      "id_cliente",
    );
  });
  it("emisión: cuerpo con booleanos y clientes", () => {
    expect(buildEmitBody(params, [3, 4], "2026-10-04")).toEqual({
      client_ids: [3, 4],
      dal: "2026-09-01",
      al: "2026-09-30",
      data_fattura: "2026-10-04",
      solo_chiusi: true,
      no_giaccrm: true,
      no_cargo: false,
      no_express: false,
      minimo: 10,
    });
  });
});

describe("validateInvoiceDate", () => {
  it("valida obligatoria, rango y orden cronológico", () => {
    expect(validateInvoiceDate("", "2026-09-01", "2026-09-30")).toBe(
      "required",
    );
    expect(validateInvoiceDate("2026-10-01", "2026-09-30", "2026-09-01")).toBe(
      "invalid_range",
    );
    expect(validateInvoiceDate("2026-08-31", "2026-09-01", "2026-09-30")).toBe(
      "before_dal",
    );
    expect(
      validateInvoiceDate("2026-10-04", "2026-09-01", "2026-09-30"),
    ).toBeNull();
  });
});

describe("clientes", () => {
  const clients: BillingClient[] = [
    {
      id_anagrafica: 1,
      total: 100,
      shipment_count: 2,
      validation: { valid: true },
    },
    {
      id_anagrafica: 2,
      total: 50,
      shipment_count: 1,
      validation: { valid: false, errors: { pi_cf: "Falta el NIF" } },
    },
    { id_anagrafica: 3, total: "25.5", shipment_count: 1 },
  ];
  it("las no válidas se excluyen y se explican", () => {
    expect(selectAllValid(clients)).toEqual([1, 3]);
    expect(invalidReasons(clients[1])).toEqual(["Falta el NIF"]);
    expect(invalidReasons(clients[0])).toEqual([]);
  });
  it("suma el total de la selección", () => {
    expect(totalOf(clients, [1, 3])).toBe(125.5);
  });
});

describe("classifyEmitError", () => {
  it("fecha no cronológica", () => {
    expect(
      classifyEmitError({
        status: 422,
        errorCode: "INVOICE_DATE_NOT_CHRONOLOGICAL",
        message: "x",
      }).kind,
    ).toBe("date");
  });
  it("sin respuesta o 5xx es incierto (no reintentar)", () => {
    expect(classifyEmitError(new Error("timeout")).kind).toBe("uncertain");
    expect(classifyEmitError({ status: 504 }).kind).toBe("uncertain");
  });
  it("otros 4xx son rechazos", () => {
    expect(classifyEmitError({ status: 403, message: "no" })).toEqual({
      kind: "rejected",
      message: "no",
    });
  });
});

describe("toResultRows", () => {
  it("une generadas, omitidas y errores", () => {
    const rows = toResultRows({
      generated: [{ id_fattura: 9, numero: "5", id_anagrafica: 1 }],
      skipped: [{ id_anagrafica: 2, reason: "NOTHING_BILLABLE" }],
      errors: [{ id_anagrafica: 3, error: "boom" }],
    });
    expect(rows.map((r) => r.kind)).toEqual(["generated", "nothing", "error"]);
  });
});

describe("monthlyBillingApi", () => {
  it("emit hace un único POST", async () => {
    httpMock.mockResolvedValue({ success: true, data: { generated: [] } });
    await monthlyBillingApi.emit(params, [1], "2026-10-04");
    expect(httpMock).toHaveBeenCalledTimes(1);
    expect(httpMock.mock.calls[0][0]).toBe("/api_invoice_generate");
    expect(httpMock.mock.calls[0][1].method).toBe("POST");
  });
  it("preview lee data.clients", async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: { clients: [{ id_anagrafica: 1 }] },
    });
    expect(await monthlyBillingApi.preview(params)).toHaveLength(1);
  });
});

describe("defaultInvoiceDate", () => {
  it("por defecto es el último día del periodo", () => {
    expect(defaultInvoiceDate("2026-09-30", false, "")).toBe("2026-09-30");
  });

  it("sigue al fin del periodo mientras no se toque a mano", () => {
    expect(defaultInvoiceDate("2026-08-31", false, "2026-09-30")).toBe("2026-08-31");
  });

  it("respeta la fecha elegida por el usuario", () => {
    expect(defaultInvoiceDate("2026-08-31", true, "2026-09-05")).toBe("2026-09-05");
  });

  it("si el usuario la borró, vuelve al fin del periodo", () => {
    expect(defaultInvoiceDate("2026-08-31", true, "")).toBe("2026-08-31");
  });

  it("sin periodo conserva lo que hay", () => {
    expect(defaultInvoiceDate("", false, "2026-09-05")).toBe("2026-09-05");
  });
});
